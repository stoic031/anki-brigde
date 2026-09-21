import { ProviderError } from '../../types';
import type { ProviderConfig } from '../providerManager';
import { requestJson } from './http';

const LIST_TIMEOUT_MS = 15_000;
const ANTHROPIC_DEFAULT_URL = 'https://api.anthropic.com';

// docs/design/06-settings.md §6.2 — asks the user's own endpoint which models it offers, to
// fill the Model dropdown. Sends the key only to that endpoint. Sorted, de-duplicated.
export async function listModels(config: ProviderConfig): Promise<string[]> {
	const isAnthropic = config.type === 'anthropic';
	const id = isAnthropic ? 'anthropic' : 'openai-compatible';
	const raw = typeof config.baseUrl === 'string' ? config.baseUrl : '';
	const baseUrl = (raw || (isAnthropic ? ANTHROPIC_DEFAULT_URL : '')).replace(
		/\/+$/,
		'',
	);
	const apiKey =
		typeof config.apiKey === 'string' ? config.apiKey.trim() : '';

	const url = isAnthropic
		? `${baseUrl}/v1/models?limit=1000`
		: `${baseUrl}/models`;
	const headers: Record<string, string> = isAnthropic
		? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
		: apiKey
			? { Authorization: `Bearer ${apiKey}` }
			: {};

	const data = await requestJson(
		'GET',
		id,
		url,
		headers,
		undefined,
		LIST_TIMEOUT_MS,
	);
	const items = (data as { data?: unknown }).data;
	if (!Array.isArray(items)) {
		throw new ProviderError(id, `unexpected response shape from ${url}`);
	}
	const ids = items.flatMap((m: unknown) => {
		const modelId = (m as { id?: unknown } | null)?.id;
		return typeof modelId === 'string' && modelId !== '' ? [modelId] : [];
	});
	return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}
