import type { ProviderConfig } from '../providerManager';
import type { ImageProvider } from '../types';
import { IMAGE_TIMEOUT_MS, requestBinary } from '../text/http';
import { str } from '../text/openaiCompatible';
import { media, noImage } from './media';

// GET {base}/image/{prompt} answers with the image bytes. The key is optional.
export function createPollinations(config: ProviderConfig): ImageProvider {
	const baseUrl = str(config.baseUrl).replace(/\/+$/, '');
	const apiKey = str(config.apiKey).trim();
	const id = 'pollinations';

	return {
		id,
		isCloud: true,
		async generateImage(prompt, opts) {
			const query = new URLSearchParams({ nologo: 'true' });
			const model = str(config.model);
			if (model) query.set('model', model);
			const negative = opts.negativePrompt ?? str(config.negativePrompt);
			if (negative) query.set('negative_prompt', negative);
			const url = `${baseUrl}/image/${encodeURIComponent(prompt)}?${query.toString()}`;
			const headers: Record<string, string> = {};
			if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
			const res = await requestBinary(id, url, headers, IMAGE_TIMEOUT_MS);
			// An error page can still come back as 200 — only accept an image.
			if (!res.mimeType.startsWith('image/')) throw noImage(id, url);
			return media(res.base64, res.mimeType);
		},
	};
}
