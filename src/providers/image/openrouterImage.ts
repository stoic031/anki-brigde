import type { ProviderConfig } from '../providerManager';
import type { ImageProvider } from '../types';
import { IMAGE_TIMEOUT_MS, postJson } from '../text/http';
import { str } from '../text/openaiCompatible';
import { fromDataUrl, noImage } from './media';

// OpenRouter image models answer through chat/completions with `modalities`, the
// picture coming back as a data URL in message.images.
export function createOpenRouterImage(config: ProviderConfig): ImageProvider {
	const baseUrl = str(config.baseUrl).replace(/\/+$/, '');
	const model = str(config.model);
	const apiKey = str(config.apiKey).trim();
	const id = 'openrouter-image';
	const url = `${baseUrl}/chat/completions`;

	return {
		id,
		isCloud: true,
		async generateImage(prompt) {
			const data = await postJson(
				id,
				url,
				{ Authorization: `Bearer ${apiKey}` },
				{
					model,
					messages: [{ role: 'user', content: prompt }],
					modalities: ['image', 'text'],
				},
				IMAGE_TIMEOUT_MS,
			);
			const image = (
				data as {
					choices?: {
						message?: {
							images?: { image_url?: { url?: unknown } }[];
						};
					}[];
				}
			).choices?.[0]?.message?.images?.[0]?.image_url?.url;
			if (typeof image !== 'string') throw noImage(id, url);
			return fromDataUrl(id, image, url);
		},
	};
}
