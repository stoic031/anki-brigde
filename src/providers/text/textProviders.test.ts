import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../../types';
import { ProviderManager } from '../providerManager';
import { createAnthropic } from './anthropic';
import { textFactories } from './index';
import { createOpenAiCompatible } from './openaiCompatible';

const { requestUrl } = vi.hoisted(() => ({ requestUrl: vi.fn() }));
vi.mock('obsidian', () => ({ requestUrl }));

const openai = (content: string) => ({
	status: 200,
	text: JSON.stringify({ choices: [{ message: { content } }] }),
});
const claude = (text: string) => ({
	status: 200,
	text: JSON.stringify({ content: [{ type: 'text', text }] }),
});

const oaConfig = {
	type: 'openai-compatible',
	baseUrl: 'https://llm.example/v1/',
	model: 'm',
};
const anConfig = { type: 'anthropic', model: 'm', apiKey: 'test-key' };

beforeEach(() => {
	requestUrl.mockReset();
	// vitest runs in Node (no `window`); http.ts uses window.setTimeout for popout-window
	// compatibility, so alias it to globalThis — same shim as sync/ankiConnect.test.ts.
	vi.stubGlobal('window', globalThis);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe.each([
	['openai-compatible', () => createOpenAiCompatible(oaConfig), openai],
	['anthropic', () => createAnthropic(anConfig), claude],
])('%s adapter', (_name, make, reply) => {
	it('returns only the requested fields as strings', async () => {
		requestUrl.mockResolvedValue(
			reply('{"Meaning":"medicine","Extra":"x","Furigana":""}'),
		);
		await expect(
			make().processText('薬', 'extract-vocabulary', [
				'Meaning',
				'Furigana',
			]),
		).resolves.toEqual({ Meaning: 'medicine' });
	});

	it('accepts a fenced JSON reply', async () => {
		requestUrl.mockResolvedValue(reply('```json\n{"Meaning":"a"}\n```'));
		await expect(
			make().processText('x', 'rewrite', ['Meaning']),
		).resolves.toEqual({ Meaning: 'a' });
	});

	it('returns { prompt } for build-image-prompt', async () => {
		requestUrl.mockResolvedValue(
			reply('{"prompt":"a red pill on a table"}'),
		);
		await expect(
			make().processText('Word: 薬', 'build-image-prompt', []),
		).resolves.toEqual({ prompt: 'a red pill on a table' });
	});

	it('retries a malformed reply once, then fails', async () => {
		requestUrl.mockResolvedValue(reply('not json'));
		await expect(
			make().processText('x', 'rewrite', ['Meaning']),
		).rejects.toBeInstanceOf(ProviderError);
		expect(requestUrl).toHaveBeenCalledTimes(2);
	});

	it('recovers when the retry is valid', async () => {
		requestUrl
			.mockResolvedValueOnce(reply('oops'))
			.mockResolvedValueOnce(reply('{"Meaning":"ok"}'));
		await expect(
			make().processText('x', 'rewrite', ['Meaning']),
		).resolves.toEqual({ Meaning: 'ok' });
	});

	it('rejects non-string field values', async () => {
		requestUrl.mockResolvedValue(reply('{"Meaning":["a"]}'));
		await expect(
			make().processText('x', 'rewrite', ['Meaning']),
		).rejects.toThrow('not a string');
	});

	it('does not retry HTTP errors and names the provider and URL', async () => {
		requestUrl.mockResolvedValue({
			status: 401,
			text: '{"error":"secret body"}',
		});
		const err = await make()
			.processText('x', 'rewrite', ['Meaning'])
			.catch((e: unknown) => e as ProviderError);
		expect(err).toBeInstanceOf(ProviderError);
		expect(err.message).toMatch(/HTTP 401 from https?:\/\//);
		expect(err.message).not.toContain('secret body');
		expect(requestUrl).toHaveBeenCalledTimes(1);
	});

	it('fails on a non-JSON or wrongly shaped body', async () => {
		requestUrl.mockResolvedValue({ status: 200, text: '<html>' });
		await expect(make().processText('x', 'rewrite', ['M'])).rejects.toThrow(
			'not JSON',
		);
		requestUrl.mockResolvedValue({ status: 200, text: '{}' });
		await expect(make().processText('x', 'rewrite', ['M'])).rejects.toThrow(
			'unexpected response shape',
		);
	});

	it('reports an unreachable endpoint with the URL', async () => {
		requestUrl.mockRejectedValue(new Error('ECONNREFUSED'));
		await expect(make().processText('x', 'rewrite', ['M'])).rejects.toThrow(
			/could not reach the endpoint \(https?:\/\//,
		);
	});
});

describe('openai-compatible specifics', () => {
	it('posts to {baseUrl}/chat/completions without auth when no key is set', async () => {
		requestUrl.mockResolvedValue(openai('{"M":"a"}'));
		await createOpenAiCompatible(oaConfig).processText('x', 'rewrite', [
			'M',
		]);
		const call = requestUrl.mock.calls[0]?.[0] as {
			url: string;
			headers: object;
		};
		expect(call.url).toBe('https://llm.example/v1/chat/completions');
		expect(call.headers).not.toHaveProperty('Authorization');
	});

	it('sends a bearer token only when a key is set', async () => {
		requestUrl.mockResolvedValue(openai('{"M":"a"}'));
		await createOpenAiCompatible({
			...oaConfig,
			apiKey: 'test-key',
		}).processText('x', 'rewrite', ['M']);
		const call = requestUrl.mock.calls[0]?.[0] as {
			headers: Record<string, string>;
		};
		expect(call.headers.Authorization).toBe('Bearer test-key');
	});

	it('labels localhost endpoints as local and others as cloud', () => {
		const local = { ...oaConfig, baseUrl: 'http://localhost:11434/v1' };
		expect(createOpenAiCompatible(local).isCloud).toBe(false);
		expect(
			createOpenAiCompatible({
				...local,
				baseUrl: 'http://127.0.0.1:1234/v1',
			}).isCloud,
		).toBe(false);
		expect(createOpenAiCompatible(oaConfig).isCloud).toBe(true);
		expect(
			createOpenAiCompatible({
				...oaConfig,
				baseUrl: 'https://localhost.evil.com/v1',
			}).isCloud,
		).toBe(true);
	});
});

describe('anthropic specifics', () => {
	it('posts to /v1/messages with x-api-key and a system prompt', async () => {
		requestUrl.mockResolvedValue(claude('{"M":"a"}'));
		await createAnthropic(anConfig).processText('x', 'rewrite', ['M']);
		const call = requestUrl.mock.calls[0]?.[0] as {
			url: string;
			headers: Record<string, string>;
			body: string;
		};
		expect(call.url).toBe('https://api.anthropic.com/v1/messages');
		expect(call.headers['x-api-key']).toBe('test-key');
		const body = JSON.parse(call.body) as {
			max_tokens: number;
			system: string;
		};
		expect(body.max_tokens).toBeGreaterThan(0);
		expect(body.system).toContain('JSON');
	});
});

describe('textFactories', () => {
	it('plugs into ProviderManager', async () => {
		requestUrl.mockResolvedValue(openai('{"M":"a"}'));
		const manager = new ProviderManager({
			text: { factories: textFactories, getConfig: () => oaConfig },
			image: { factories: {}, getConfig: () => null },
		});
		const provider = manager.getTextProvider();
		expect(provider?.id).toBe('openai-compatible');
		await expect(
			provider?.processText('x', 'rewrite', ['M']),
		).resolves.toEqual({ M: 'a' });
	});
});
