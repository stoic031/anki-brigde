import type { ProviderConfig } from '../providerManager';
import type { TextProvider } from '../types';
import { createAnthropic } from './anthropic';
import { createOpenAiCompatible } from './openaiCompatible';

// The single registration point for text adapters — pass as ProviderManager `text.factories`.
export const textFactories: Record<
	string,
	(config: ProviderConfig) => TextProvider
> = {
	'openai-compatible': createOpenAiCompatible,
	anthropic: createAnthropic,
};
