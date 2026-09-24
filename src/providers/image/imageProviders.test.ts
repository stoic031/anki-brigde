import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../types';
import { IMAGE_PRESETS } from '../presets';
import type { ImageProvider } from '../types';
import { createAutomatic1111 } from './automatic1111';
import { createComfyUi } from './comfyui';
import { createGeminiImage } from './geminiImage';
import { imageFactories } from './index';
import { createOpenAiImage } from './openaiImage';
import { createOpenRouterImage } from './openrouterImage';
import { createPollinations } from './pollinations';

const { requestUrl } = vi.hoisted(() => ({ requestUrl: vi.fn() }));
vi.mock('obsidian', () => ({
	requestUrl,
	arrayBufferToBase64: (b: ArrayBuffer) =>
		btoa(String.fromCharCode(...new Uint8Array(b))),
}));

const ok = (data: unknown) => ({ status: 200, text: JSON.stringify(data) });
const bytes = (type: string) => ({
	status: 200,
	text: '',
	arrayBuffer: new Uint8Array([1, 2, 3]).buffer,
	headers: { 'Content-Type': type },
});
const call = (i = 0) =>
	requestUrl.mock.calls[i]?.[0] as {
		url: string;
		method?: string;
		headers?: Record<string, string>;
		body?: string;
	};
const body = (i = 0) =>
	JSON.parse(call(i).body ?? '{}') as Record<string, unknown>;

beforeEach(() => {
	requestUrl.mockReset();
	vi.stubGlobal('window', globalThis);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

const cloud = { apiKey: 'test-key', negativePrompt: '', workflow: '' };

// [name, provider, a successful reply]
const cases: [string, () => ImageProvider, () => unknown][] = [
	[
		'pollinations',
		() =>
			createPollinations({
				type: 'pollinations',
				baseUrl: 'https://gen.example/',
				model: 'flux',
				...cloud,
				negativePrompt: 'blurry',
			}),
		() => bytes('image/jpeg; charset=binary'),
	],
	[
		'openai-image',
		() =>
			createOpenAiImage({
				type: 'openai-image',
				baseUrl: 'https://api.example/v1',
				model: 'dall-e-3',
				...cloud,
			}),
		() => ok({ data: [{ b64_json: 'AQID' }] }),
	],
	[
		'gemini-image',
		() =>
			createGeminiImage({
				type: 'gemini-image',
				baseUrl: 'https://gem.example/v1beta',
				model: 'models/gemini-image',
				...cloud,
			}),
		() =>
			ok({
				candidates: [
					{
						content: {
							parts: [
								{ text: 'here' },
								{
									inlineData: {
										mimeType: 'image/png',
										data: 'AQID',
									},
								},
							],
						},
					},
				],
			}),
	],
	[
		'openrouter-image',
		() =>
			createOpenRouterImage({
				type: 'openrouter-image',
				baseUrl: 'https://or.example/api/v1',
				model: 'img',
				...cloud,
			}),
		() =>
			ok({
				choices: [
					{
						message: {
							images: [
								{
									image_url: {
										url: 'data:image/png;base64,AQID',
									},
								},
							],
						},
					},
				],
			}),
	],
	[
		'automatic1111',
		() =>
			createAutomatic1111({
				type: 'automatic1111',
				baseUrl: 'http://localhost:7860',
				model: '',
				...cloud,
				negativePrompt: 'blurry',
			}),
		() => ok({ images: ['AQID'] }),
	],
];

describe.each(cases)('%s adapter', (_name, make, reply) => {
	it('returns a normalized MediaResult', async () => {
		requestUrl.mockResolvedValue(reply());
		const result = await make().generateImage('a cat', {});
		expect(result.base64).toBe('AQID');
		expect(result.mimeType).toMatch(/^image\//);
		expect(result.ext).toMatch(/^(png|jpg)$/);
	});

	it('throws ProviderError on non-200', async () => {
		requestUrl.mockResolvedValue({ status: 401, text: '' });
		await expect(make().generateImage('a cat', {})).rejects.toThrow(
			/HTTP 401/,
		);
	});

	it('explains a 429 as the provider’s rate limit, with Retry-After if sent', async () => {
		requestUrl.mockResolvedValue({ status: 429, text: '' });
		await expect(make().generateImage('a cat', {})).rejects.toThrow(
			/rate-limited by .+ \(HTTP 429\)\. Wait a minute/,
		);

		requestUrl.mockResolvedValue({
			status: 429,
			text: '',
			headers: { 'Retry-After': '20' },
		});
		await expect(make().generateImage('a cat', {})).rejects.toThrow(
			/Try again in 20 s\.$/,
		);
	});

	it('explains a 402 as running out of credits at the provider', async () => {
		requestUrl.mockResolvedValue({ status: 402, text: '' });
		await expect(make().generateImage('a cat', {})).rejects.toThrow(
			/out of credits at .+ \(HTTP 402\)\. Add credits/,
		);
	});

	it('throws ProviderError when the reply has no image', async () => {
		requestUrl.mockResolvedValue(
			_name === 'pollinations' ? bytes('text/html') : ok({}),
		);
		await expect(make().generateImage('a cat', {})).rejects.toThrow(
			/unexpected response shape/,
		);
	});

	it('times out', async () => {
		vi.useFakeTimers();
		requestUrl.mockReturnValue(new Promise(() => {}));
		const pending = expect(
			make().generateImage('a cat', {}),
		).rejects.toThrow(/timed out/);
		await vi.advanceTimersByTimeAsync(120_000);
		await pending;
	});
});

describe('request shapes', () => {
	it('pollinations puts the prompt in the path and the negative prompt in the query', async () => {
		requestUrl.mockResolvedValue(bytes('image/jpeg'));
		const r = await cases[0]![1]().generateImage('a cat', {});
		expect(r.ext).toBe('jpg');
		const url = new URL(call().url);
		expect(url.origin + url.pathname).toBe(
			'https://gen.example/image/a%20cat',
		);
		expect(url.searchParams.get('model')).toBe('flux');
		expect(url.searchParams.get('negative_prompt')).toBe('blurry');
		expect(call().headers?.Authorization).toBe('Bearer test-key');
	});

	it('openai sends response_format only for dall-e models', async () => {
		requestUrl.mockResolvedValue(ok({ data: [{ b64_json: 'AQID' }] }));
		await cases[1]![1]().generateImage('a cat', {});
		expect(body().response_format).toBe('b64_json');
		await createOpenAiImage({
			type: 'openai-image',
			baseUrl: 'https://api.example/v1',
			model: 'gpt-image-1',
			...cloud,
		}).generateImage('a cat', {});
		expect(body(1)).not.toHaveProperty('response_format');
		expect(call(1).url).toBe('https://api.example/v1/images/generations');
	});

	it('gemini calls generateContent with the key header', async () => {
		requestUrl.mockResolvedValue(cases[2]![2]());
		await cases[2]![1]().generateImage('a cat', {});
		expect(call().url).toBe(
			'https://gem.example/v1beta/models/gemini-image:generateContent',
		);
		expect(call().headers?.['x-goog-api-key']).toBe('test-key');
	});

	it('openrouter asks for image modality', async () => {
		requestUrl.mockResolvedValue(cases[3]![2]());
		await cases[3]![1]().generateImage('a cat', {});
		expect(body().modalities).toEqual(['image', 'text']);
	});

	it('automatic1111 sends the negative prompt, and a checkpoint only when set', async () => {
		requestUrl.mockResolvedValue(ok({ images: ['AQID'] }));
		const a1111 = cases[4]![1]();
		expect(a1111.isCloud).toBe(false);
		await a1111.generateImage('a cat', {});
		expect(body()).toEqual({ prompt: 'a cat', negative_prompt: 'blurry' });
		await createAutomatic1111({
			type: 'automatic1111',
			baseUrl: 'http://localhost:7860',
			model: 'sdxl.safetensors',
		}).generateImage('a cat', {});
		expect(body(1).override_settings).toEqual({
			sd_model_checkpoint: 'sdxl.safetensors',
		});
	});
});

describe('comfyui adapter', () => {
	const workflow = {
		'3': {
			class_type: 'KSampler',
			inputs: { seed: 1, positive: ['6', 0], negative: ['7', 0] },
		},
		'6': { class_type: 'CLIPTextEncode', inputs: { text: 'saved prompt' } },
		'7': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } },
		'9': { class_type: 'SaveImage', inputs: { images: ['3', 0] } },
	};
	const comfy = () =>
		createComfyUi({
			type: 'comfyui',
			baseUrl: 'http://localhost:8188/',
			workflow: 'cards.json',
		});

	it('replaces the positive prompt, queues it, polls history and fetches the output', async () => {
		vi.useFakeTimers();
		requestUrl
			.mockResolvedValueOnce(ok(workflow)) // userdata
			.mockResolvedValueOnce(ok({})) // object_info
			.mockResolvedValueOnce(ok({ prompt_id: 'p1' })) // prompt
			.mockResolvedValueOnce(ok({})) // history: still running
			.mockResolvedValueOnce(
				ok({
					p1: {
						status: { status_str: 'success' },
						outputs: {
							'9': {
								images: [
									{
										filename: 'a.png',
										subfolder: '',
										type: 'output',
									},
								],
							},
						},
					},
				}),
			)
			.mockResolvedValueOnce(bytes('image/png'));

		const pending = comfy().generateImage('a cat', {});
		await vi.advanceTimersByTimeAsync(1_000);
		const result = await pending;

		expect(result).toEqual({
			base64: 'AQID',
			ext: 'png',
			mimeType: 'image/png',
		});
		const queued = body(2).prompt as typeof workflow;
		expect(queued['6'].inputs.text).toBe('a cat');
		expect(queued['7'].inputs.text).toBe('ugly');
		expect(call(3).url).toBe('http://localhost:8188/history/p1');
		expect(call(5).url).toBe(
			'http://localhost:8188/view?filename=a.png&subfolder=&type=output',
		);
	});

	it('refuses a workflow without a positive prompt node', async () => {
		requestUrl
			.mockResolvedValueOnce(ok({ '9': workflow['9'] }))
			.mockResolvedValueOnce(ok({}));
		await expect(comfy().generateImage('a cat', {})).rejects.toThrow(
			/can't take a prompt: no KSampler/,
		);
	});

	it('reports a failed run', async () => {
		requestUrl
			.mockResolvedValueOnce(ok(workflow))
			.mockResolvedValueOnce(ok({}))
			.mockResolvedValueOnce(ok({ prompt_id: 'p1' }))
			.mockResolvedValueOnce(
				ok({ p1: { status: { status_str: 'error' } } }),
			);
		await expect(comfy().generateImage('a cat', {})).rejects.toBeInstanceOf(
			ProviderError,
		);
	});
});

it('registers an adapter for every image preset', () => {
	for (const preset of Object.values(IMAGE_PRESETS))
		expect(imageFactories).toHaveProperty(preset.adapter);
});
