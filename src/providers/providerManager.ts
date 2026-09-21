import { ProviderError } from '../types';
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
	private resolve<P extends { id: string }>(
		kind: ProviderKind<P>,
		cached: Cached<P> | null,
	): Cached<P> | null {
		const config = kind.getConfig();
		if (!config) return null;
		const key = JSON.stringify(config);
		if (cached?.key === key) return cached;
		const factory = kind.factories[config.type];
		if (!factory) {
			throw new ProviderError(
				config.type,
				'no adapter for this provider type',
			);
		}
		try {
			return { key, provider: normalizeErrors(factory(config)) };
		} catch (err) {
			throw toProviderError(config.type, err);
		}
	}
}

function toProviderError(providerId: string, err: unknown): ProviderError {
	if (err instanceof ProviderError) return err;
	return new ProviderError(
		providerId,
		err instanceof Error ? err.message : String(err),
	);
}

// docs/design/02-providers.md §2.3 — every failure reaches callers as a ProviderError.
// Errors are normalized only, the manager never switches to another provider.
function normalizeErrors<P extends { id: string }>(provider: P): P {
	return new Proxy(provider, {
		get(target, prop) {
			const value: unknown = Reflect.get(target, prop);
			if (typeof value !== 'function') return value;
			return async (...args: unknown[]) => {
				try {
					return await (value as (...a: unknown[]) => unknown).apply(
						target,
						args,
					);
				} catch (err) {
					throw toProviderError(target.id, err);
				}
			};
		},
	});
}
