import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '../types';
import {
	ProviderManager,
	type ProviderConfig,
	type ProviderManagerOptions,
} from './providerManager';
import type { ImageProvider, TextProvider } from './types';

function textProvider(
	id: string,
	processText: TextProvider['processText'] = () => Promise.resolve({}),
): TextProvider {
	return { id, isCloud: true, processText };
}

// Every kind starts unconfigured; tests override only what they exercise.
function makeManager(
	overrides: Partial<ProviderManagerOptions> = {},
): ProviderManager {
	return new ProviderManager({
		text: { factories: {}, getConfig: () => null },
		image: { factories: {}, getConfig: () => null },
		...overrides,
	});
}

describe('ProviderManager selection', () => {
	it('builds the provider whose factory matches the config type', () => {
		const a = vi.fn(() => textProvider('a'));
		const b = vi.fn((config: ProviderConfig) =>
			textProvider(String(config.name)),
		);
		const config = { type: 'b', name: 'mine' };
		const manager = makeManager({
			text: { factories: { a, b }, getConfig: () => config },
		});

		expect(manager.getTextProvider()?.id).toBe('mine');
		expect(b).toHaveBeenCalledWith(config);
		expect(a).not.toHaveBeenCalled();
	});

	it('returns null for every kind when nothing is configured', () => {
		const manager = makeManager();

		expect(manager.getTextProvider()).toBeNull();
		expect(manager.getImageProvider()).toBeNull();
	});
});

describe('ProviderManager lazy init', () => {
	it('calls neither getConfig nor a factory until a provider is requested', () => {
		const factory = vi.fn(() => textProvider('x'));
		const getConfig = vi.fn(() => ({ type: 'x' }));

		makeManager({ text: { factories: { x: factory }, getConfig } });

		expect(getConfig).not.toHaveBeenCalled();
		expect(factory).not.toHaveBeenCalled();
	});

	it('builds once and reuses the instance while the config is unchanged', () => {
		const factory = vi.fn(() => textProvider('x'));
		const manager = makeManager({
			text: {
				factories: { x: factory },
				getConfig: () => ({ type: 'x' }),
			},
		});

		expect(manager.getTextProvider()).toBe(manager.getTextProvider());
		expect(factory).toHaveBeenCalledTimes(1);
	});

	it('rebuilds when the config changes and returns null once it is cleared', () => {
		const factory = vi.fn((config: ProviderConfig) =>
			textProvider(String(config.model)),
		);
		let config: ProviderConfig | null = { type: 'x', model: 'one' };
		const manager = makeManager({
			text: { factories: { x: factory }, getConfig: () => config },
		});

		expect(manager.getTextProvider()?.id).toBe('one');
		config = { type: 'x', model: 'two' };
		expect(manager.getTextProvider()?.id).toBe('two');
		config = null;
		expect(manager.getTextProvider()).toBeNull();
		expect(factory).toHaveBeenCalledTimes(2);
	});
});

describe('ProviderManager error normalization', () => {
	function textManager(
		processText: TextProvider['processText'],
	): TextProvider {
		const manager = makeManager({
			text: {
				factories: { x: () => textProvider('x', processText) },
				getConfig: () => ({ type: 'x' }),
			},
		});
		const provider = manager.getTextProvider();
		if (!provider) throw new Error('expected a text provider');
		return provider;
	}

	it('wraps an Error thrown by the provider as ProviderError', async () => {
		const provider = textManager(() => Promise.reject(new Error('boom')));

		const err: unknown = await provider
			.processText('a', 'rewrite', [])
			.catch((e: unknown) => e);

		expect(err).toBeInstanceOf(ProviderError);
		expect((err as ProviderError).providerId).toBe('x');
		expect((err as ProviderError).message).toBe('x: boom');
	});

	it('stringifies a non-Error rejection', async () => {
		// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- non-Error rejection is the case under test
		const provider = textManager(() => Promise.reject('plain string'));

		await expect(provider.processText('a', 'rewrite', [])).rejects.toThrow(
			'x: plain string',
		);
	});

	it('normalizes a synchronous throw too', async () => {
		const provider = textManager(() => {
			throw new Error('sync boom');
		});

		await expect(
			provider.processText('a', 'rewrite', []),
		).rejects.toBeInstanceOf(ProviderError);
	});

	it('passes an existing ProviderError through unchanged', async () => {
		const original = new ProviderError('other', 'already normalized');
		const provider = textManager(() => Promise.reject(original));

		await expect(provider.processText('a', 'rewrite', [])).rejects.toBe(
			original,
		);
	});

	it('keeps id and isCloud and returns successful results untouched', async () => {
		const provider = textManager(() => Promise.resolve({ Meaning: 'hi' }));

		expect(provider.id).toBe('x');
		expect(provider.isCloud).toBe(true);
		await expect(
			provider.processText('a', 'rewrite', ['Meaning']),
		).resolves.toEqual({
			Meaning: 'hi',
		});
	});

	it('wraps image provider failures', async () => {
		const image: ImageProvider = {
			id: 'i1',
			isCloud: false,
			generateImage: () => Promise.reject(new Error('down')),
		};
		const manager = makeManager({
			image: {
				factories: { x: () => image },
				getConfig: () => ({ type: 'x' }),
			},
		});

		await expect(
			manager.getImageProvider()?.generateImage('p', {}),
		).rejects.toBeInstanceOf(ProviderError);
	});

	it('throws ProviderError naming an unknown provider type', () => {
		const manager = makeManager({
			text: { factories: {}, getConfig: () => ({ type: 'nope' }) },
		});

		expect(() => manager.getTextProvider()).toThrow(ProviderError);
		expect(() => manager.getTextProvider()).toThrow('nope');
	});

	it('wraps a throwing factory as ProviderError', () => {
		const manager = makeManager({
			text: {
				factories: {
					x: () => {
						throw new Error('bad config');
					},
				},
				getConfig: () => ({ type: 'x' }),
			},
		});

		expect(() => manager.getTextProvider()).toThrow(ProviderError);
		expect(() => manager.getTextProvider()).toThrow('x: bad config');
	});

	it('never switches to another provider after a failure', async () => {
		const other = vi.fn(() => textProvider('other'));
		const manager = makeManager({
			text: {
				factories: {
					x: () =>
						textProvider('x', () =>
							Promise.reject(new Error('boom')),
						),
					other,
				},
				getConfig: () => ({ type: 'x' }),
			},
		});

		await expect(
			manager.getTextProvider()?.processText('a', 'rewrite', []),
		).rejects.toBeInstanceOf(ProviderError);
		expect(other).not.toHaveBeenCalled();
	});
});
