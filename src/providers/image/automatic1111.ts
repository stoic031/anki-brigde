import type { ProviderConfig } from '../providerManager';
import type { ImageProvider } from '../types';
import {
	IMAGE_TIMEOUT_MS,
	isLocalUrl,
	postJson,
	str,
	trimSlash,
} from '../http';
import { media, noImage } from './media';

// Stable Diffusion WebUI API (started with --api). An empty model keeps whatever
// checkpoint is loaded.
export function createAutomatic1111(config: ProviderConfig): ImageProvider {
	const baseUrl = trimSlash(str(config.baseUrl));
	const model = str(config.model);
	const id = 'automatic1111';
	const url = `${baseUrl}/sdapi/v1/txt2img`;

	return {
		id,
		isCloud: !isLocalUrl(baseUrl),
		async generateImage(prompt, opts) {
			const body: Record<string, unknown> = {
				prompt,
				negative_prompt:
					opts.negativePrompt ?? str(config.negativePrompt),
			};
			if (opts.steps) body.steps = opts.steps;
			if (model) body.override_settings = { sd_model_checkpoint: model };
			const data = await postJson(id, url, {}, body, IMAGE_TIMEOUT_MS);
			const image = (data as { images?: unknown[] }).images?.[0];
			if (typeof image !== 'string' || !image) throw noImage(id, url);
			return media(image, 'image/png');
		},
	};
}
