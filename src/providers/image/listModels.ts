import { ProviderError } from '../../types';
import type { ProviderConfig } from '../providerManager';
import { requestJson } from '../text/http';
import { listModels } from '../text/listModels';

const LIST_TIMEOUT_MS = 15_000;
export const AUTOMATIC1111_DEFAULT_URL = 'http://localhost:7860';

// docs/design/06-settings.md §6.2 — checkpoints/models the user's own endpoint offers.
// OpenAI-compatible endpoints share the text `/models` listing; Automatic1111 has its own.
export async function listImageModels(
	config: ProviderConfig,
): Promise<string[]> {
	if (config.type !== 'automatic1111') return listModels(config);

	const raw = typeof config.baseUrl === 'string' ? config.baseUrl : '';
	const url = `${raw.replace(/\/+$/, '')}/sdapi/v1/sd-models`;
	const data = await requestJson(
		'GET',
		'automatic1111',
		url,
		{},
		undefined,
		LIST_TIMEOUT_MS,
	);
	if (!Array.isArray(data)) {
		throw new ProviderError(
			'automatic1111',
			`unexpected response shape from ${url}`,
		);
	}
	const names = data.flatMap((m: unknown) => {
		const name = (m as { model_name?: unknown } | null)?.model_name;
		return typeof name === 'string' && name !== '' ? [name] : [];
	});
	return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}
