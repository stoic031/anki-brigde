import type { ProviderConfig } from '../providerManager';
import type { ImageProvider } from '../types';
import { IMAGE_TIMEOUT_MS, postJson } from '../text/http';
import { str } from '../text/openaiCompatible';
import { media, noImage } from './media';

// POST {base}/images/generations. gpt-image-* always returns b64_json and rejects
// response_format; dall-e-* needs it or it returns a URL.
export function createOpenAiImage(config: ProviderConfig): ImageProvider {
	const baseUrl = str(config.baseUrl).replace(/\/+$/, '');
	const model = str(config.model);
	const apiKey = str(config.apiKey).trim();
	const id = 'openai-image';
	const url = `${baseUrl}/images/generations`;

	return {
		id,
		isCloud: true,
		async generateImage(prompt, opts) {
			const body: Record<string, unknown> = { model, prompt, n: 1 };
			if (model.startsWith('dall-e')) body.response_format = 'b64_json';
			if (opts.size) body.size = opts.size;
			const data = await postJson(
				id,
				url,
				{ Authorization: `Bearer ${apiKey}` },
				body,
				IMAGE_TIMEOUT_MS,
			);
			const b64 = (data as { data?: { b64_json?: unknown }[] }).data?.[0]
				?.b64_json;
			if (typeof b64 !== 'string' || !b64) throw noImage(id, url);
			return media(b64, 'image/png');
		},
	};
}
