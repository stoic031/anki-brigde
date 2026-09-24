import type { ProviderConfig } from '../providerManager';
import type { TextProvider } from '../types';
import { badShape, isLocalUrl, postJson, str, trimSlash } from '../http';
import { runText } from './runText';

export function createOpenAiCompatible(config: ProviderConfig): TextProvider {
	const baseUrl = trimSlash(str(config.baseUrl));
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
			throw badShape(id, url);
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
