import { badShape } from '../http';
import { ProviderError } from '../../types';
import type { MediaResult } from '../types';

export function extFromMime(mimeType: string): string {
	const sub = mimeType.split('/')[1]?.toLowerCase() ?? '';
	if (sub === 'jpeg') return 'jpg';
	return /^[a-z0-9]+$/.test(sub) ? sub : 'png';
}

export function media(base64: string, mimeType: string): MediaResult {
	const type = mimeType.startsWith('image/') ? mimeType : 'image/png';
	return { base64, ext: extFromMime(type), mimeType: type };
}

// "data:image/png;base64,AAAA" → MediaResult.
export function fromDataUrl(
	providerId: string,
	url: string,
	source: string,
): MediaResult {
	const m = /^data:([^;,]+);base64,(.+)$/s.exec(url);
	if (!m?.[1] || !m[2]) {
		throw badShape(providerId, source);
	}
	return media(m[2], m[1]);
}

export function noImage(providerId: string, url: string): ProviderError {
	return badShape(providerId, url);
}
