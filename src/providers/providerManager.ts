import type { AudioProvider, ImageProvider, TextProvider } from './types';

export interface ProviderConfig {
	type: string;
	[key: string]: unknown;
}

type Factory<P> = (config: ProviderConfig) => P;

export interface ProviderKind<P> {
	factories: Record<string, Factory<P>>; // keyed by ProviderConfig.type
	getConfig: () => ProviderConfig | null; // read at call time; null = not configured
}

export interface ProviderManagerOptions {
	text: ProviderKind<TextProvider>;
	audio: ProviderKind<AudioProvider>;
	image: ProviderKind<ImageProvider>;
}

interface Cached<P> {
	key: string;
	provider: P;
}

// docs/design/02-providers.md §2.3 — providers are built on first use, never on load.
export class ProviderManager {
	private text: Cached<TextProvider> | null = null;
	private audio: Cached<AudioProvider> | null = null;
	private image: Cached<ImageProvider> | null = null;

	constructor(private readonly options: ProviderManagerOptions) {}

	getTextProvider(): TextProvider | null {
		return (
			(this.text = this.resolve(this.options.text, this.text))
				?.provider ?? null
		);
	}

	getAudioProvider(): AudioProvider | null {
		return (
			(this.audio = this.resolve(this.options.audio, this.audio))
				?.provider ?? null
		);
	}

	getImageProvider(): ImageProvider | null {
		return (
			(this.image = this.resolve(this.options.image, this.image))
				?.provider ?? null
		);
	}

	// Rebuilds only when the config changed since the cached instance was made.
	private resolve<P>(
		kind: ProviderKind<P>,
		cached: Cached<P> | null,
	): Cached<P> | null {
		const config = kind.getConfig();
		if (!config) return null;
		const key = JSON.stringify(config);
		if (cached?.key === key) return cached;
		const factory = kind.factories[config.type];
		if (!factory) {
			throw new Error(`Unknown AI provider type "${config.type}"`);
		}
		return { key, provider: factory(config) };
	}
}
