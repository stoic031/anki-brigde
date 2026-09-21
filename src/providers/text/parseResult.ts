import { ProviderError } from '../../types';
import type { TextResult } from '../types';

// docs/design/02-providers.md §2.4 / .claude/rules/providers.md — model output is
// untrusted: strip fences, parse in try/catch, validate, never return a half-typed object.
export function parseTextResult(
	providerId: string,
	raw: string,
	keys: string[],
): TextResult {
	const cleaned = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '');
	let data: unknown;
	try {
		data = JSON.parse(cleaned);
	} catch {
		throw new ProviderError(providerId, 'model reply was not valid JSON');
	}
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		throw new ProviderError(
			providerId,
			'model reply was not a JSON object',
		);
	}
	const result: TextResult = {};
	for (const key of keys) {
		const value = (data as Record<string, unknown>)[key];
		if (value === undefined || value === null || value === '') continue;
		if (typeof value !== 'string') {
			throw new ProviderError(
				providerId,
				`field "${key}" was not a string`,
			);
		}
		result[key] = value;
	}
	return result;
}
