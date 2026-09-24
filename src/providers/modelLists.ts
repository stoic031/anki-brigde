import { ProviderError } from '../types';
import { badShape, obj, requestJson, trimSlash } from './http';

export type ModelKind = 'text' | 'image';

export interface ModelList {
	models: string[];
	total: number; // how many models the endpoint reported before filtering
	// The provider-specific filter left nothing, so every model the endpoint reported is shown.
	fellBack: boolean;
}

// One row from a provider's model endpoint, reduced to what the filters look at.
interface Entry {
	id: string;
	type?: string; // Together
	outputs?: string[]; // OpenRouter / Pollinations output_modalities
	category?: string; // Pollinations: 'image' | 'video'
	community?: boolean; // Pollinations: third-party model
	status?: string; // Pollinations health.status
}

const LIST_TIMEOUT_MS = 15_000;
const get = (id: string, url: string, headers: Record<string, string>) =>
	requestJson('GET', id, url, headers, undefined, LIST_TIMEOUT_MS);
const bearer = (key: string): Record<string, string> =>
	key ? { Authorization: `Bearer ${key}` } : {};

// docs/design/06-settings.md §6.2 — how each fixed provider reports its models.
type Fetcher = (baseUrl: string, key: string) => Promise<Entry[]>;

// OpenAI, Groq, OpenRouter, Together, Gemini (compat): `{data: [...]}` or a bare array.
const openAiStyle =
	(id: string, stripPrefix = ''): Fetcher =>
	async (baseUrl, key) => {
		const url = `${trimSlash(baseUrl)}/models`;
		const data = await get(id, url, bearer(key));
		const items = Array.isArray(data) ? data : obj(data).data;
		if (!Array.isArray(items)) throw badShape(id, url);
		return items.flatMap((m: unknown) => {
			const row = obj(m);
			if (typeof row.id !== 'string' || row.id === '') return [];
			const outputs = obj(row.architecture).output_modalities;
			return [
				{
					id:
						stripPrefix && row.id.startsWith(stripPrefix)
							? row.id.slice(stripPrefix.length)
							: row.id,
					type: typeof row.type === 'string' ? row.type : undefined,
					outputs: Array.isArray(outputs)
						? outputs.filter(
								(o): o is string => typeof o === 'string',
							)
						: undefined,
				},
			];
		});
	};

const FETCHERS: Record<string, Fetcher> = {
	openai: openAiStyle('openai'),
	groq: openAiStyle('groq'),
	openrouter: openAiStyle('openrouter'),
	together: openAiStyle('together'),
	// Text uses `.../v1beta/openai`, Image the native `.../v1beta`. The native /models answers
	// a different shape and doesn't take a Bearer key, so both list through the compat endpoint.
	gemini: (baseUrl, key) =>
		openAiStyle('gemini', 'models/')(
			`${trimSlash(baseUrl).replace(/\/openai$/, '')}/openai`,
			key,
		),

	anthropic: async (baseUrl, key) => {
		const url = `${trimSlash(baseUrl)}/v1/models?limit=1000`;
		const data = await get('anthropic', url, {
			'x-api-key': key,
			'anthropic-version': '2023-06-01',
		});
		const items = obj(data).data;
		if (!Array.isArray(items)) throw badShape('anthropic', url);
		return items.flatMap((m: unknown) =>
			typeof obj(m).id === 'string' ? [{ id: obj(m).id as string }] : [],
		);
	},

	ollama: async (host) => {
		const url = `${trimSlash(host)}/api/tags`;
		const items = obj(await get('ollama', url, {})).models;
		if (!Array.isArray(items)) throw badShape('ollama', url);
		return items.flatMap((m: unknown) =>
			typeof obj(m).name === 'string'
				? [{ id: obj(m).name as string }]
				: [],
		);
	},

	// The old image.pollinations.ai/models now lists a single model; gen.pollinations.ai/image/models
	// is the current catalogue (image and video, official and community entries).
	pollinations: async (baseUrl, key) => {
		const url = `${trimSlash(baseUrl)}/image/models`;
		const data = await get('pollinations', url, bearer(key));
		if (!Array.isArray(data)) throw badShape('pollinations', url);
		return data.flatMap((m: unknown): Entry[] => {
			const row = obj(m);
			const name = typeof m === 'string' ? m : row.name;
			if (typeof name !== 'string' || name === '') return [];
			const outputs = row.output_modalities;
			return [
				{
					id: name,
					category:
						typeof row.category === 'string'
							? row.category
							: undefined,
					outputs: Array.isArray(outputs)
						? outputs.filter(
								(o): o is string => typeof o === 'string',
							)
						: undefined,
					community: row.community === true,
					status:
						typeof obj(row.health).status === 'string'
							? (obj(row.health).status as string)
							: undefined,
				},
			];
		});
	},

	automatic1111: async (baseUrl) => {
		const url = `${trimSlash(baseUrl)}/sdapi/v1/sd-models`;
		const data = await get('automatic1111', url, {});
		if (!Array.isArray(data)) throw badShape('automatic1111', url);
		return data.flatMap((m: unknown) =>
			typeof obj(m).model_name === 'string' && obj(m).model_name !== ''
				? [{ id: obj(m).model_name as string }]
				: [],
		);
	},
};

// Providers that report modality or type are filtered exactly; the rest by model name, which
// is best effort (a new model with an unusual name may be hidden). Absent = keep everything.
const NON_TEXT =
	/(embed|whisper|tts|transcribe|audio|realtime|image|dall-e|moderation|orpheus|rerank|guard|search-preview|imagen|veo|aqa|live|bge-|minilm|e5-)/i;

const FILTERS: Record<string, (e: Entry) => boolean> = {
	// OpenRouter: text-to-text = the output is exactly text (image/audio inputs are fine).
	// Models that also output audio (lyria, gpt-audio) or images are not. Its own routers
	// pick a model themselves, so they are not text-to-image models either.
	'text:openrouter': (e) =>
		e.outputs?.length === 1 && e.outputs[0] === 'text',
	'image:openrouter': (e) =>
		!!e.outputs?.includes('image') && !e.id.startsWith('openrouter/'),
	'text:together': (e) => ['chat', 'language', 'code'].includes(e.type ?? ''),
	'image:together': (e) => e.type === 'image',
	'text:openai': (e) =>
		/^(gpt-|chatgpt-|o\d)/.test(e.id) && !NON_TEXT.test(e.id),
	'image:openai': (e) => /^(dall-e|gpt-image)/.test(e.id),
	// Gemini: an allow-list, because Google keeps adding differently named non-text models
	// (nano-banana, lyria, veo...). Text = gemini-*/gemma-* minus the non-text variants.
	'text:gemini': (e) =>
		/^(gemini|gemma)-/i.test(e.id) &&
		!/(image|tts|live|audio|transcribe|embedding|robotics|computer-use|omni|translate)/i.test(
			e.id,
		),
	'image:gemini': (e) => /(imagen|-image|nano-banana)/i.test(e.id),
	// Groq: every text-to-text model. Only the speech models are hidden (whisper = speech-to-text,
	// tts/orpheus = text-to-speech); safety models such as llama-guard are text-to-text and stay.
	'text:groq': (e) => !/(whisper|tts|orpheus)/i.test(e.id),
	// Pollinations: everything except video (community, paid and unhealthy models included).
	'image:pollinations': (e) =>
		e.category !== 'video' &&
		(e.outputs === undefined || e.outputs.includes('image')),
	'text:ollama': (e) => !NON_TEXT.test(e.id),
};

const uniqueSorted = (ids: string[]) =>
	[...new Set(ids)].sort((a, b) => a.localeCompare(b));

export async function listModels(
	kind: ModelKind,
	providerId: string,
	baseUrl: string,
	apiKey: string,
): Promise<ModelList> {
	const fetcher = FETCHERS[providerId];
	if (!fetcher)
		throw new ProviderError(providerId, 'no model list for this provider');
	const entries = await fetcher(baseUrl, apiKey.trim());
	const all = uniqueSorted(entries.map((e) => e.id));
	const keep = FILTERS[`${kind}:${providerId}`];
	if (!keep) return { models: all, total: all.length, fellBack: false };
	const kept = uniqueSorted(entries.filter(keep).map((e) => e.id));
	return kept.length > 0
		? { models: kept, total: all.length, fellBack: false }
		: { models: all, total: all.length, fellBack: all.length > 0 };
}
