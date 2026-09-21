import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../types';
import { listImageModels } from './listModels';

const { requestUrl } = vi.hoisted(() => ({ requestUrl: vi.fn() }));
vi.mock('obsidian', () => ({ requestUrl }));

const ok = (data: unknown) => ({ status: 200, text: JSON.stringify(data) });
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

describe('listImageModels', () => {
	it('lists Automatic1111 checkpoints from /sdapi/v1/sd-models by model_name', async () => {
		requestUrl.mockResolvedValue(
			ok([
				{ title: 'b.safetensors [x]', model_name: 'b' },
				{ title: 'a.safetensors [y]', model_name: 'a' },
				{ model_name: 'b' },
				{ title: 'no name' },
			]),
		);

		const models = await listImageModels({
			type: 'automatic1111',
			baseUrl: 'http://localhost:7860/',
		});

		expect(models).toEqual(['a', 'b']);
		expect(call()).toMatchObject({
			url: 'http://localhost:7860/sdapi/v1/sd-models',
			method: 'GET',
		});
		expect(call().headers).toEqual({});
	});

	it('fails with a ProviderError when Automatic1111 replies with the wrong shape or is down', async () => {
		const cfg = { type: 'automatic1111', baseUrl: 'http://localhost:7860' };
		requestUrl.mockResolvedValue(ok({ detail: 'nope' }));
		await expect(listImageModels(cfg)).rejects.toBeInstanceOf(
			ProviderError,
		);

		requestUrl.mockRejectedValue(new Error('ECONNREFUSED'));
		await expect(listImageModels(cfg)).rejects.toThrow(
			/could not reach the endpoint \(http:\/\/localhost:7860\/sdapi\/v1\/sd-models\)/,
		);
	});

	it('uses the shared /models listing for OpenAI-compatible endpoints', async () => {
		requestUrl.mockResolvedValue(
			ok({ data: [{ id: 'gpt-image-1' }, { id: 'dall-e-3' }] }),
		);

		const models = await listImageModels({
			type: 'openai-compatible',
			baseUrl: 'https://api.openai.com/v1',
			apiKey: 'test-key',
		});

		expect(models).toEqual(['dall-e-3', 'gpt-image-1']);
		expect(call().url).toBe('https://api.openai.com/v1/models');
		expect(call().headers.Authorization).toBe('Bearer test-key');
	});
});
