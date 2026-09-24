// docs/design/02-providers.md §2.2 — the fixed provider lists. More are added on request,
// not by letting users type arbitrary endpoints (model filtering needs to know the provider).
export type TextProviderId =
	| 'openai'
	| 'gemini'
	| 'anthropic'
	| 'groq'
	| 'openrouter'
	| 'together'
	| 'ollama';

export type ImageProviderId =
	| 'pollinations'
	| 'gemini'
	| 'openai'
	| 'openrouter'
	| 'automatic1111'
	| 'comfyui';

export interface ProviderPreset {
	id: string;
	label: string;
	cloud: boolean; // drives the Cloud/Local badge
	baseUrl: string; // fixed endpoint for cloud providers, editable default for local ones
	editableUrl: boolean; // only local, user-hosted providers
	key: 'required' | 'optional' | 'none';
	modelOptional?: boolean; // provider has its own default model/checkpoint
	workflow?: boolean; // configured by a saved workflow instead of a model (ComfyUI)
	adapter: string; // ProviderConfig `type` the adapter factory is registered under
	apiBase: (url: string) => string; // what the adapter is given as its Base URL
}

const same = (url: string) => url;

const cloud = (
	id: string,
	label: string,
	baseUrl: string,
	adapter: string,
	extra: Partial<ProviderPreset> = {},
): ProviderPreset => ({
	id,
	label,
	cloud: true,
	baseUrl,
	editableUrl: false,
	key: 'required',
	adapter,
	apiBase: same,
	...extra,
});

const OPENAI = 'openai-compatible';

export const TEXT_PRESETS: Record<TextProviderId, ProviderPreset> = {
	openai: cloud('openai', 'OpenAI', 'https://api.openai.com/v1', OPENAI),
	// Gemini's OpenAI-compatible endpoint, so the OpenAI-compatible adapter serves it.
	gemini: cloud(
		'gemini',
		'Gemini',
		'https://generativelanguage.googleapis.com/v1beta/openai',
		OPENAI,
	),
	anthropic: cloud(
		'anthropic',
		'Anthropic',
		'https://api.anthropic.com',
		'anthropic',
	),
	groq: cloud('groq', 'Groq', 'https://api.groq.com/openai/v1', OPENAI),
	openrouter: cloud(
		'openrouter',
		'OpenRouter',
		'https://openrouter.ai/api/v1',
		OPENAI,
	),
	together: cloud(
		'together',
		'Together',
		'https://api.together.xyz/v1',
		OPENAI,
	),
	ollama: {
		id: 'ollama',
		label: 'Ollama',
		cloud: false,
		baseUrl: 'http://localhost:11434',
		editableUrl: true,
		key: 'none',
		adapter: OPENAI,
		apiBase: (host) => `${host.replace(/\/+$/, '')}/v1`,
	},
};

export const IMAGE_PRESETS: Record<ImageProviderId, ProviderPreset> = {
	pollinations: cloud(
		'pollinations',
		'Pollinations',
		'https://gen.pollinations.ai',
		'pollinations',
		{ key: 'optional', modelOptional: true },
	),
	gemini: cloud(
		'gemini',
		'Gemini',
		'https://generativelanguage.googleapis.com/v1beta',
		'gemini-image',
	),
	openai: cloud(
		'openai',
		'OpenAI',
		'https://api.openai.com/v1',
		'openai-image',
	),
	openrouter: cloud(
		'openrouter',
		'OpenRouter',
		'https://openrouter.ai/api/v1',
		'openrouter-image',
	),
	automatic1111: {
		id: 'automatic1111',
		label: 'Automatic1111',
		cloud: false,
		baseUrl: 'http://localhost:7860',
		editableUrl: true,
		key: 'none',
		modelOptional: true,
		adapter: 'automatic1111',
		apiBase: same,
	},
	comfyui: {
		id: 'comfyui',
		label: 'ComfyUI',
		cloud: false,
		baseUrl: 'http://localhost:8188',
		editableUrl: true,
		key: 'none',
		workflow: true,
		adapter: 'comfyui',
		apiBase: same,
	},
};

export const presetLabel = (p: ProviderPreset): string =>
	`${p.label} (${p.cloud ? 'cloud' : 'local'})`;
