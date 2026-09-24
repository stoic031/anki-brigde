import type { ProviderConfig } from '../providerManager';
import type { ImageProvider } from '../types';
import { IMAGE_TIMEOUT_MS, postJson, str, trimSlash } from '../http';
import { media, noImage } from './media';

interface Part {
	inlineData?: { mimeType?: unknown; data?: unknown };
}

// Native generateContent (…/v1beta), not the OpenAI-compatible endpoint: Gemini image
// models return the picture as an inlineData part next to optional text.
export function createGeminiImage(config: ProviderConfig): ImageProvider {
	const baseUrl = trimSlash(str(config.baseUrl));
	const model = str(config.model).replace(/^models\//, '');
	const apiKey = str(config.apiKey).trim();
	const id = 'gemini-image';
	const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;

	return {
		id,
		isCloud: true,
		async generateImage(prompt) {
			const data = await postJson(
				id,
				url,
				{ 'x-goog-api-key': apiKey },
				{
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
				},
				IMAGE_TIMEOUT_MS,
			);
			const parts = (
				data as { candidates?: { content?: { parts?: Part[] } }[] }
			).candidates?.[0]?.content?.parts;
			const inline = parts?.find(
				(p) => typeof p.inlineData?.data === 'string',
			)?.inlineData;
			if (!inline) throw noImage(id, url);
			return media(
				inline.data as string,
				typeof inline.mimeType === 'string' ? inline.mimeType : '',
			);
		},
	};
}
