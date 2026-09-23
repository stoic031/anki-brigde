import { ProviderError } from '../../types';
import type { ProviderConfig } from '../providerManager';
import type { TextProvider } from '../types';
import { postJson } from './http';
import { runText } from './runText';

export const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/i;

// docs/design/06-settings.md §6.2 — Cloud/Local label is derived from the Base URL.
export function isLocalUrl(baseUrl: string): boolean {
	return LOCAL_HOST.test(baseUrl);
}

export function createOpenAiCompatible(config: ProviderConfig): TextProvider {
	const baseUrl = str(config.baseUrl).replace(/\/+$/, '');
	const model = str(config.model);
	const apiKey = str(config.apiKey).trim();
	const id = 'openai-compatible';
	const url = `${baseUrl}/chat/completions`;

	async function complete(system: string, user: string): Promise<string> {
		const headers: Record<string, string> = {};
		if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
		const data = await postJson(id, url, headers, {
			model,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user },
			],
		});
		const content = (
			data as { choices?: { message?: { content?: unknown } }[] }
		).choices?.[0]?.message?.content;
		if (typeof content !== 'string') {
			throw new ProviderError(
				id,
				`unexpected response shape from ${url}`,
			);
		}
		return content;
	}

	return {
		id,
		isCloud: !isLocalUrl(baseUrl),
		processText: (input, task, targetFields, context) =>
			runText(id, input, task, targetFields, complete, context),
	};
}
