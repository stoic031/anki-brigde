import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../types';
import { listModels } from './modelLists';

const { requestUrl } = vi.hoisted(() => ({ requestUrl: vi.fn() }));
vi.mock('obsidian', () => ({ requestUrl }));

const ok = (data: unknown) => ({ status: 200, text: JSON.stringify(data) });
const ids = (...names: string[]) => ({ data: names.map((id) => ({ id })) });
const call = () =>
	requestUrl.mock.calls[0]?.[0] as {
		url: string;
		method: string;
		headers: Record<string, string>;
	};

beforeEach(() => {
	requestUrl.mockReset();
	vi.stubGlobal('window', globalThis);
});
afterEach(() => vi.unstubAllGlobals());

describe('text model lists', () => {
	it('OpenAI keeps chat models and drops embeddings, audio, image and moderation', async () => {
		requestUrl.mockResolvedValue(
			ok(
				ids(
					'gpt-4o',
					'gpt-4o-mini',
					'o3-mini',
					'chatgpt-4o-latest',
					'text-embedding-3-small',
					'whisper-1',
					'tts-1',
					'dall-e-3',
					'gpt-image-1',
					'gpt-4o-audio-preview',
					'gpt-4o-realtime-preview',
					'omni-moderation-latest',
					'gpt-4o-search-preview',
				),
			),
		);

		const r = await listModels(
			'text',
			'openai',
			'https://api.openai.com/v1',
			'test-key',
		);

		expect(r).toEqual({
			models: ['chatgpt-4o-latest', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'],
			total: 13,
			fellBack: false,
		});
		expect(call()).toMatchObject({
			url: 'https://api.openai.com/v1/models',
			method: 'GET',
		});
		expect(call().headers.Authorization).toBe('Bearer test-key');
	});

	it('OpenRouter text is exactly text output; image needs image output and excludes its routers', async () => {
		const m = (id: string, input: string[], output: string[]) => ({
			id,
			architecture: {
				input_modalities: input,
				output_modalities: output,
			},
		});
		requestUrl.mockResolvedValue(
			ok({
				data: [
					m('a/chat', ['text'], ['text']),
					m('b/vision', ['text', 'image', 'file'], ['text']),
					m(
						'google/gemini-2.5-flash-image',
						['image', 'text'],
						['image', 'text'],
					),
					m(
						'openai/gpt-5-image',
						['image', 'text', 'file'],
						['image', 'text'],
					),
					m(
						'google/lyria-3-clip-preview',
						['text', 'image'],
						['text', 'audio'],
					),
					m('openai/gpt-audio', ['text', 'audio'], ['text', 'audio']),
					m('openrouter/auto', ['text', 'image'], ['text', 'image']),
					{ id: 'd/none' },
				],
			}),
		);
		const base = 'https://openrouter.ai/api/v1';

		const text = await listModels('text', 'openrouter', base, '');
		expect(text.models).toEqual(['a/chat', 'b/vision']);
		expect(text.total).toBe(8);
		expect(
			(await listModels('image', 'openrouter', base, '')).models,
		).toEqual(['google/gemini-2.5-flash-image', 'openai/gpt-5-image']);
	});

	it('Together filters by type and accepts a bare array', async () => {
		requestUrl.mockResolvedValue(
			ok([
				{ id: 'meta/llama', type: 'chat' },
				{ id: 'bge', type: 'embedding' },
				{ id: 'flux', type: 'image' },
				{ id: 'code', type: 'code' },
			]),
		);

		expect(
			(
				await listModels(
					'text',
					'together',
					'https://api.together.xyz/v1',
					'k',
				)
			).models,
		).toEqual(['code', 'meta/llama']);
		expect(
			(
				await listModels(
					'image',
					'together',
					'https://api.together.xyz/v1',
					'k',
				)
			).models,
		).toEqual(['flux']);
	});

	it('Gemini text is an allow-list of gemini-*/gemma-*; lyria, nano-banana, veo and the rest are not text', async () => {
		const text = [
			'gemini-2.5-flash',
			'gemini-2.5-flash-lite',
			'gemini-2.5-pro',
			'gemini-3-pro-preview',
			'gemini-flash-latest',
			'gemma-3-27b-it',
		];
		const image = [
			'gemini-2.5-flash-image',
			'gemini-3-pro-image',
			'nano-banana-2',
			'nano-banana-pro-preview',
			'imagen-4.0-generate-001',
		];
		const neither = [
			'gemini-3.1-flash-live-preview',
			'gemini-2.5-flash-preview-tts',
			'gemini-2.5-flash-native-audio-preview-12-2025',
			'gemini-3.5-transcribe',
			'gemini-embedding-001',
			'gemini-robotics-er-1.5-preview',
			'gemini-2.5-computer-use-preview-10-2025',
			'gemini-omni-flash',
			'lyria-3-clip-preview',
			'lyria-realtime-exp',
			'veo-3.1-generate-preview',
			'text-embedding-004',
			'aqa',
		];
		requestUrl.mockResolvedValue(
			ok(
				ids(
					...[...neither, ...image, ...text].map(
						(n) => `models/${n}`,
					),
				),
			),
		);
		const base = 'https://generativelanguage.googleapis.com/v1beta/openai';

		const t = await listModels('text', 'gemini', base, 'k');
		expect(t.models).toEqual([...text].sort((a, b) => a.localeCompare(b)));
		expect(t.total).toBe(text.length + image.length + neither.length);
		expect((await listModels('image', 'gemini', base, 'k')).models).toEqual(
			[...image].sort((a, b) => a.localeCompare(b)),
		);
	});

	it('Gemini image lists through the OpenAI-compatible endpoint even though its preset base is the native /v1beta', async () => {
		requestUrl.mockResolvedValue(
			ok(
				ids(
					'models/gemini-2.5-flash',
					'models/gemini-2.5-flash-image',
					'models/nano-banana-pro-preview',
					'models/imagen-4.0-generate-001',
					'models/lyria-3-clip-preview',
					'models/veo-3.1-generate-preview',
				),
			),
		);

		const r = await listModels(
			'image',
			'gemini',
			'https://generativelanguage.googleapis.com/v1beta',
			'test-key',
		);

		expect(r.models).toEqual([
			'gemini-2.5-flash-image',
			'imagen-4.0-generate-001',
			'nano-banana-pro-preview',
		]);
		expect(call().url).toBe(
			'https://generativelanguage.googleapis.com/v1beta/openai/models',
		);
		expect(call().headers.Authorization).toBe('Bearer test-key');
	});

	it('Groq shows every text-to-text model and hides only the speech ones', async () => {
		const textToText = [
			'allam-2-7b',
			'deepseek-r1-distill-llama-70b',
			'gemma2-9b-it',
			'groq/compound',
			'groq/compound-mini',
			'llama-3.1-8b-instant',
			'llama-3.3-70b-versatile',
			'meta-llama/llama-4-maverick-17b-128e-instruct',
			'meta-llama/llama-4-scout-17b-16e-instruct',
			'moonshotai/kimi-k2-instruct',
			'openai/gpt-oss-120b',
			'openai/gpt-oss-20b',
			'qwen/qwen3-32b',
			'qwen/qwen3.6-27b',
			// safety models are still text-to-text
			'llama-guard-3-8b',
			'meta-llama/llama-guard-4-12b',
			'meta-llama/llama-prompt-guard-2-22m',
			'meta-llama/llama-prompt-guard-2-86m',
			'openai/gpt-oss-safeguard-20b',
		];
		const speech = [
			'whisper-large-v3',
			'whisper-large-v3-turbo',
			'playai-tts',
			'playai-tts-arabic',
			'canopylabs/orpheus-v1-english',
			'canopylabs/orpheus-arabic-saudi',
		];
		requestUrl.mockResolvedValue(ok(ids(...speech, ...textToText)));

		const r = await listModels(
			'text',
			'groq',
			'https://api.groq.com/openai/v1',
			'k',
		);

		expect(r.models).toEqual(
			[...textToText].sort((a, b) => a.localeCompare(b)),
		);
		expect(r.total).toBe(textToText.length + speech.length);
		expect(r.fellBack).toBe(false);
	});

	it('Anthropic sends x-api-key and keeps everything', async () => {
		requestUrl.mockResolvedValue(ok(ids('claude-b', 'claude-a')));

		const r = await listModels(
			'text',
			'anthropic',
			'https://api.anthropic.com',
			'test-key',
		);

		expect(r.models).toEqual(['claude-a', 'claude-b']);
		expect(call().url).toBe(
			'https://api.anthropic.com/v1/models?limit=1000',
		);
		expect(call().headers['x-api-key']).toBe('test-key');
		expect(call().headers).not.toHaveProperty('Authorization');
	});

	it('Ollama reads /api/tags and drops embedding models', async () => {
		requestUrl.mockResolvedValue(
			ok({
				models: [
					{ name: 'llama3.1:8b' },
					{ name: 'nomic-embed-text:latest' },
					{ name: 'bge-m3' },
				],
			}),
		);

		const r = await listModels(
			'text',
			'ollama',
			'http://localhost:11434/',
			'',
		);

		expect(r.models).toEqual(['llama3.1:8b']);
		expect(call().url).toBe('http://localhost:11434/api/tags');
		expect(call().headers).toEqual({});
	});

	it('falls back to every model when the filter leaves none', async () => {
		requestUrl.mockResolvedValue(ok(ids('whisper-1', 'tts-1')));

		expect(
			await listModels(
				'text',
				'groq',
				'https://api.groq.com/openai/v1',
				'k',
			),
		).toEqual({
			models: ['tts-1', 'whisper-1'],
			total: 2,
			fellBack: true,
		});
	});
});

describe('image model lists', () => {
	it('OpenAI keeps only dall-e and gpt-image models', async () => {
		requestUrl.mockResolvedValue(
			ok(ids('gpt-4o', 'dall-e-3', 'gpt-image-1', 'whisper-1')),
		);

		expect(
			(
				await listModels(
					'image',
					'openai',
					'https://api.openai.com/v1',
					'k',
				)
			).models,
		).toEqual(['dall-e-3', 'gpt-image-1']);
	});

	it('Pollinations shows every model except video', async () => {
		const entry = (name: string, over: Record<string, unknown> = {}) => ({
			name,
			category: 'image',
			community: false,
			output_modalities: ['image'],
			health: { status: 'healthy' },
			...over,
		});
		requestUrl.mockResolvedValue(
			ok([
				entry('openai/gpt-image-2'),
				entry('black-forest-labs/flux.2-max', { paid_only: true }),
				entry('google/veo-3.1-fast', {
					category: 'video',
					output_modalities: ['video'],
				}),
				entry('minimax/minimax-h3', {
					category: 'video',
					output_modalities: ['video', 'audio'],
				}),
				entry('community/MarcosFRG/flux-1-schnell', {
					community: true,
				}),
				entry('bytedance/seedream-5.0-lite', {
					health: { status: 'down' },
				}),
				entry('amazon/nova-canvas-v1', { health: {} }),
			]),
		);

		const r = await listModels(
			'image',
			'pollinations',
			'https://gen.pollinations.ai',
			'',
		);

		expect(r.models).toEqual([
			'amazon/nova-canvas-v1',
			'black-forest-labs/flux.2-max',
			'bytedance/seedream-5.0-lite',
			'community/MarcosFRG/flux-1-schnell',
			'openai/gpt-image-2',
		]);
		expect(r.total).toBe(7);
		expect(call().url).toBe('https://gen.pollinations.ai/image/models');
		expect(call().headers).toEqual({});
	});

	it('Pollinations sends the key when one is set and still accepts the old list of names', async () => {
		requestUrl.mockResolvedValue(ok(['sana', 'turbo']));

		const r = await listModels(
			'image',
			'pollinations',
			'https://gen.pollinations.ai',
			'test-key',
		);

		expect(r.models).toEqual(['sana', 'turbo']);
		expect(call().headers.Authorization).toBe('Bearer test-key');
	});

	it('Automatic1111 lists checkpoints by model_name', async () => {
		requestUrl.mockResolvedValue(
			ok([
				{ model_name: 'b', title: 't' },
				{ model_name: 'a' },
				{ title: 'x' },
			]),
		);

		const r = await listModels(
			'image',
			'automatic1111',
			'http://localhost:7860/',
			'',
		);

		expect(r.models).toEqual(['a', 'b']);
		expect(call().url).toBe('http://localhost:7860/sdapi/v1/sd-models');
	});
});

describe('failures', () => {
	it('throws a ProviderError naming the provider and URL, never the body', async () => {
		requestUrl.mockResolvedValue({
			status: 401,
			text: '{"error":"secret body"}',
		});

		const err = (await listModels(
			'text',
			'openai',
			'https://api.openai.com/v1',
			'k',
		).catch((e: unknown) => e)) as ProviderError;

		expect(err).toBeInstanceOf(ProviderError);
		expect(err.message).toBe(
			'openai: HTTP 401 from https://api.openai.com/v1/models',
		);
	});

	it('throws on a wrong shape and when the endpoint is unreachable', async () => {
		requestUrl.mockResolvedValue(ok({ nope: true }));
		await expect(
			listModels('text', 'openai', 'https://x/v1', 'k'),
		).rejects.toThrow('unexpected response shape');
		await expect(
			listModels('image', 'automatic1111', 'http://localhost:7860', ''),
		).rejects.toThrow('unexpected response shape');

		requestUrl.mockRejectedValue(new Error('ECONNREFUSED'));
		await expect(
			listModels('text', 'ollama', 'http://localhost:11434', ''),
		).rejects.toThrow(
			/could not reach the endpoint \(http:\/\/localhost:11434\/api\/tags\)/,
		);
	});

	it('rejects an unknown provider id', async () => {
		await expect(
			listModels('text', 'nope', 'https://x', ''),
		).rejects.toThrow('no model list');
	});
});
