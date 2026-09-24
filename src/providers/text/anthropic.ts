import type { ProviderConfig } from '../providerManager';
import type { TextProvider } from '../types';
import { badShape, isLocalUrl, postJson, str } from '../http';
import { runText } from './runText';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const MAX_TOKENS = 1024;

export function createAnthropic(config: ProviderConfig): TextProvider {
	const baseUrl = (str(config.baseUrl) || DEFAULT_BASE_URL).replace(
		/\/+$/,
		'',
	);
	const model = str(config.model);
	const apiKey = str(config.apiKey).trim();
	const id = 'anthropic';
	const url = `${baseUrl}/v1/messages`;

	async function complete(system: string, user: string): Promise<string> {
		const data = await postJson(
			id,
			url,
			{ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
			{
				model,
				max_tokens: MAX_TOKENS,
				system,
				messages: [{ role: 'user', content: user }],
			},
		);
		const text = (data as { content?: { text?: unknown }[] }).content?.[0]
			?.text;
		if (typeof text !== 'string') {
			throw badShape(id, url);
		}
		return text;
	}

	return {
		id,
		isCloud: !isLocalUrl(baseUrl),
		processText: (input, task, targetFields, context) =>
			runText(id, input, task, targetFields, complete, context),
	};
}
