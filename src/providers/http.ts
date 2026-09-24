import {
	arrayBufferToBase64,
	requestUrl,
	type RequestUrlParam,
	type RequestUrlResponse,
} from 'obsidian';
import { ProviderError } from '../types';
import { TimeoutError, withTimeout } from '../utils/timeout';

export const str = (v: unknown): string => (typeof v === 'string' ? v : '');
export const obj = (v: unknown): Record<string, unknown> =>
	typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
export const trimSlash = (url: string): string => url.replace(/\/+$/, '');
export const badShape = (providerId: string, url: string): ProviderError =>
	new ProviderError(providerId, `unexpected response shape from ${url}`);

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/i;

// docs/design/06-settings.md §6.2 — Cloud/Local label is derived from the Base URL.
export function isLocalUrl(baseUrl: string): boolean {
	return LOCAL_HOST.test(baseUrl);
}

export const TEXT_TIMEOUT_MS = 60_000;
export const IMAGE_TIMEOUT_MS = 120_000; // image models are slower than text

// Errors name the provider and URL; bodies and headers are never included.
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
	const { text } = await request(
		providerId,
		{
			url,
			method,
			contentType: 'application/json',
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		},
		timeoutMs,
	);
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new ProviderError(
			providerId,
			`response from ${url} was not JSON`,
		);
	}
}

// GET a binary body (an image) as raw base64 + its Content-Type.
export async function requestBinary(
	providerId: string,
	url: string,
	headers: Record<string, string>,
	timeoutMs = TEXT_TIMEOUT_MS,
): Promise<{ base64: string; mimeType: string }> {
	const res = await request(providerId, { url, headers }, timeoutMs);
	const type = Object.entries(res.headers ?? {}).find(
		([k]) => k.toLowerCase() === 'content-type',
	)?.[1];
	return {
		base64: arrayBufferToBase64(res.arrayBuffer),
		mimeType: (type ?? '').split(';')[0]?.trim() ?? '',
	};
}

async function request(
	providerId: string,
	params: RequestUrlParam,
	timeoutMs: number,
): Promise<RequestUrlResponse> {
	const { url } = params;
	let response: RequestUrlResponse;
	try {
		response = await withTimeout(
			requestUrl({ ...params, throw: false }),
			timeoutMs,
		);
	} catch (err) {
		const reason =
			err instanceof TimeoutError
				? `timed out after ${timeoutMs}ms`
				: 'could not reach the endpoint';
		throw new ProviderError(providerId, `${reason} (${url})`);
	}

	// Account-side limits (OpenRouter credits, free-tier rate limits) — say it's the
	// provider's limit and what to do, rather than a bare status that reads like our
	// failure. No auto-retry: it would only spend more of the same quota.
	const host = new URL(url).host;
	const accountHint: Record<number, string> = {
		402: `out of credits at ${host} (HTTP 402). Add credits there, or pick a cheaper or free model in settings.`,
		429: `rate-limited by ${host} (HTTP 429). Wait a minute, then try again — free models have low limits.`,
	};
	const hint = accountHint[response.status];
	if (hint !== undefined) {
		const retryAfter = Number(
			Object.entries(response.headers ?? {}).find(
				([k]) => k.toLowerCase() === 'retry-after',
			)?.[1],
		);
		const wait =
			retryAfter > 0 ? ` Try again in ${Math.ceil(retryAfter)} s.` : '';
		throw new ProviderError(providerId, `${hint}${wait}`);
	}
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(
			providerId,
			`HTTP ${response.status} from ${url}`,
		);
	}
	return response;
}
