import { requestUrl } from 'obsidian';
import { ProviderError } from '../../types';

export const TEXT_TIMEOUT_MS = 60_000;

// requestUrl (not fetch) avoids CORS in Obsidian's renderer but has no timeout, so we
// race one. Errors name the provider and URL; bodies and headers are never included.
export function postJson(
	providerId: string,
	url: string,
	headers: Record<string, string>,
	body: unknown,
	timeoutMs = TEXT_TIMEOUT_MS,
): Promise<unknown> {
	return requestJson('POST', providerId, url, headers, body, timeoutMs);
}

export async function requestJson(
	method: 'GET' | 'POST',
	providerId: string,
	url: string,
	headers: Record<string, string>,
	body?: unknown,
	timeoutMs = TEXT_TIMEOUT_MS,
): Promise<unknown> {
	const timeoutError = new Error('timeout');
	let timer: ReturnType<typeof window.setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = window.setTimeout(() => reject(timeoutError), timeoutMs);
	});

	let status: number;
	let text: string;
	try {
		const response = await Promise.race([
			requestUrl({
				url,
				method,
				contentType: 'application/json',
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
				throw: false,
			}),
			timeout,
		]);
		({ status, text } = response);
	} catch (err) {
		const reason =
			err === timeoutError
				? `timed out after ${timeoutMs}ms`
				: 'could not reach the endpoint';
		throw new ProviderError(providerId, `${reason} (${url})`);
	} finally {
		window.clearTimeout(timer);
	}

	if (status < 200 || status >= 300) {
		throw new ProviderError(providerId, `HTTP ${status} from ${url}`);
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new ProviderError(
			providerId,
			`response from ${url} was not JSON`,
		);
	}
}
