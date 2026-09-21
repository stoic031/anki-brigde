import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../types';
import { listModels } from './listModels';

const { requestUrl } = vi.hoisted(() => ({ requestUrl: vi.fn() }));
vi.mock('obsidian', () => ({ requestUrl }));

const ok = (data: unknown) => ({ status: 200, text: JSON.stringify(data) });
const call = () =>
	requestUrl.mock.calls[0]?.[0] as {
		url: string;
		method: string;
		headers: Record<string, string>;
		body?: string;
	};

beforeEach(() => {
	requestUrl.mockReset();
	vi.stubGlobal('window', globalThis);
});
afterEach(() => vi.unstubAllGlobals());

describe('listModels', () => {
	it('GETs {baseUrl}/models for openai-compatible with a bearer key', async () => {
		requestUrl.mockResolvedValue(
			ok({ data: [{ id: 'b' }, { id: 'a' }, { id: 'b' }] }),
		);

		const models = await listModels({
			type: 'openai-compatible',
			baseUrl: 'https://llm.example/v1/',
			apiKey: 'test-key',
		});

		expect(models).toEqual(['a', 'b']);
		expect(call()).toMatchObject({
			url: 'https://llm.example/v1/models',
			method: 'GET',
		});
		expect(call().headers.Authorization).toBe('Bearer test-key');
		expect(call().body).toBeUndefined();
	});

	it('sends no Authorization header without a key', async () => {
		requestUrl.mockResolvedValue(ok({ data: [] }));
		await listModels({
			type: 'openai-compatible',
			baseUrl: 'http://localhost:11434/v1',
			apiKey: '',
		});

		expect(call().headers).not.toHaveProperty('Authorization');
	});

	it('uses /v1/models with x-api-key for anthropic, defaulting the base URL', async () => {
		requestUrl.mockResolvedValue(ok({ data: [{ id: 'claude-x' }] }));

		const models = await listModels({
			type: 'anthropic',
			baseUrl: '',
			apiKey: 'test-key',
		});

		expect(models).toEqual(['claude-x']);
		expect(call().url).toBe(
			'https://api.anthropic.com/v1/models?limit=1000',
		);
		expect(call().headers['x-api-key']).toBe('test-key');
		expect(call().headers['anthropic-version']).toBeDefined();
	});

	it('skips entries without a string id', async () => {
		requestUrl.mockResolvedValue(
			ok({ data: [{ id: 'a' }, { id: 5 }, null, {}, { id: '' }] }),
		);

		expect(
			await listModels({
				type: 'openai-compatible',
				baseUrl: 'https://x/v1',
			}),
		).toEqual(['a']);
	});

	it('fails with a ProviderError on a wrong shape, HTTP error or unreachable endpoint', async () => {
		const cfg = { type: 'openai-compatible', baseUrl: 'https://x/v1' };
		requestUrl.mockResolvedValue(ok({ models: [] }));
		await expect(listModels(cfg)).rejects.toThrow(
			'unexpected response shape',
		);

		requestUrl.mockResolvedValue({
			status: 404,
			text: '{"error":"secret body"}',
		});
		const err = (await listModels(cfg).catch(
			(e: unknown) => e,
		)) as ProviderError;
		expect(err).toBeInstanceOf(ProviderError);
		expect(err.message).toBe(
			'openai-compatible: HTTP 404 from https://x/v1/models',
		);

		requestUrl.mockRejectedValue(new Error('ECONNREFUSED'));
		await expect(listModels(cfg)).rejects.toThrow(
			/could not reach the endpoint \(https:\/\/x\/v1\/models\)/,
		);
	});
});
