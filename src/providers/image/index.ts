import type { ProviderConfig } from '../providerManager';
import type { ImageProvider } from '../types';
import { createAutomatic1111 } from './automatic1111';
import { createComfyUi } from './comfyui';
import { createGeminiImage } from './geminiImage';
import { createOpenAiImage } from './openaiImage';
import { createOpenRouterImage } from './openrouterImage';
import { createPollinations } from './pollinations';

// The single registration point for image adapters — keys are IMAGE_PRESETS[*].adapter.
export const imageFactories: Record<
	string,
	(config: ProviderConfig) => ImageProvider
> = {
	pollinations: createPollinations,
	'openai-image': createOpenAiImage,
	'gemini-image': createGeminiImage,
	'openrouter-image': createOpenRouterImage,
	automatic1111: createAutomatic1111,
	comfyui: createComfyUi,
};
