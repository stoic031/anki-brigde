import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	fieldConfigKey,
	getActiveProfile,
	getActiveImageConfig,
	getActiveTextConfig,
	loadSettings,
	resolveAnkiConnectUrl,
	saveSettings,
	type AnkiBridgeSettings,
	type ImageProviderConfig,
	type TextProviderConfig,
} from './settings';
import { DEFAULT_ANKI_CONNECT_URL } from './utils/constants';

// Returns the spies as plain locals (not read back off `plugin`) so assertions like
// `expect(saveData).toHaveBeenCalledWith(...)` don't trip @typescript-eslint/unbound-method.
function fakePlugin(loadedData: unknown): {
	plugin: Plugin;
	saveData: ReturnType<typeof vi.fn>;
} {
	const saveData = vi.fn().mockResolvedValue(undefined);
	const plugin = {
		loadData: vi.fn().mockResolvedValue(loadedData),
		saveData,
	} as unknown as Plugin;
	return { plugin, saveData };
}

describe('loadSettings', () => {
	it('falls back to DEFAULT_SETTINGS when there is no saved data', async () => {
		const { plugin } = fakePlugin(null);

		await expect(loadSettings(plugin)).resolves.toEqual(DEFAULT_SETTINGS);
	});

	it('merges partial saved data over DEFAULT_SETTINGS', async () => {
		const { plugin } = fakePlugin({
			ankiConnectUrl: 'http://localhost:9999',
		});

		await expect(loadSettings(plugin)).resolves.toEqual({
			...DEFAULT_SETTINGS,
			ankiConnectUrl: 'http://localhost:9999',
		});
	});

	it('does not share the default profiles array between loads', async () => {
		const first = await loadSettings(fakePlugin(null).plugin);
		first.profiles[0]!.deck = 'Mutated';

		const second = await loadSettings(fakePlugin(null).plugin);

		expect(second.profiles[0]?.deck).toBe('');
	});

	it('preserves saved profiles and the active profile', async () => {
		const profiles = [
			{ id: 'a', name: 'A', deck: 'D1', model: 'M1', folder: 'F1' },
			{ id: 'b', name: 'B', deck: 'D2', model: 'M2', folder: '' },
		];
		const { plugin } = fakePlugin({ profiles, activeProfileId: 'b' });

		const loaded = await loadSettings(plugin);

		expect(loaded.profiles).toEqual(profiles);
		expect(loaded.activeProfileId).toBe('b');
	});

	it('falls back to the first profile when activeProfileId is unknown', async () => {
		const profiles = [
			{ id: 'a', name: 'A', deck: '', model: '', folder: '' },
		];
		const { plugin } = fakePlugin({ profiles, activeProfileId: 'gone' });

		await expect(loadSettings(plugin)).resolves.toMatchObject({
			activeProfileId: 'a',
		});
	});

	describe('legacy migration', () => {
		it('turns default* fields into a Default profile and drops the old keys', async () => {
			const { plugin } = fakePlugin({
				defaultDeck: 'Deck',
				defaultModel: 'Model',
				defaultFolder: 'Anki Notes',
			});

			const loaded = await loadSettings(plugin);

			expect(loaded.profiles).toEqual([
				{
					id: 'default',
					name: 'Default',
					deck: 'Deck',
					model: 'Model',
					folder: 'Anki Notes',
				},
			]);
			expect(loaded.activeProfileId).toBe('default');
			expect(loaded).not.toHaveProperty('defaultDeck');
			expect(loaded).not.toHaveProperty('currentFolder');
		});

		it('prefers current* over default* (what the user last used)', async () => {
			const { plugin } = fakePlugin({
				defaultDeck: 'OldDeck',
				currentDeck: 'NewDeck',
				defaultModel: 'OldModel',
				currentModel: 'NewModel',
				defaultFolder: 'Old',
				currentFolder: 'New',
			});

			const loaded = await loadSettings(plugin);

			expect(loaded.profiles[0]).toMatchObject({
				deck: 'NewDeck',
				model: 'NewModel',
				folder: 'New',
			});
		});
	});
});

describe('getActiveProfile', () => {
	it('returns the active profile', () => {
		const settings = {
			...DEFAULT_SETTINGS,
			profiles: [
				{ id: 'a', name: 'A', deck: '', model: '', folder: '' },
				{ id: 'b', name: 'B', deck: '', model: '', folder: '' },
			],
			activeProfileId: 'b',
		};

		expect(getActiveProfile(settings).id).toBe('b');
	});
});

describe('saveSettings', () => {
	it('writes the settings object via plugin.saveData', async () => {
		const { plugin, saveData } = fakePlugin(null);
		const settings: AnkiBridgeSettings = {
			ankiConnectUrl: 'http://localhost:1234',
			profiles: DEFAULT_SETTINGS.profiles,
			activeProfileId: DEFAULT_SETTINGS.activeProfileId,
			generateWithAiFields: {},
			textProviders: [],
			activeTextProviderId: '',
			imageProviders: [],
			activeImageProviderId: '',
		};

		await saveSettings(plugin, settings);

		expect(saveData).toHaveBeenCalledWith(settings);
	});
});

describe('resolveAnkiConnectUrl', () => {
	it('returns the default when the setting is blank', () => {
		expect(
			resolveAnkiConnectUrl({
				ankiConnectUrl: '',
				profiles: DEFAULT_SETTINGS.profiles,
				activeProfileId: DEFAULT_SETTINGS.activeProfileId,
				generateWithAiFields: {},
				textProviders: [],
				activeTextProviderId: '',
				imageProviders: [],
				activeImageProviderId: '',
			}),
		).toBe(DEFAULT_ANKI_CONNECT_URL);
	});

	it('returns the default when the setting is whitespace only', () => {
		expect(
			resolveAnkiConnectUrl({
				ankiConnectUrl: '   ',
				profiles: DEFAULT_SETTINGS.profiles,
				activeProfileId: DEFAULT_SETTINGS.activeProfileId,
				generateWithAiFields: {},
				textProviders: [],
				activeTextProviderId: '',
				imageProviders: [],
				activeImageProviderId: '',
			}),
		).toBe(DEFAULT_ANKI_CONNECT_URL);
	});

	it('returns the trimmed value when set', () => {
		expect(
			resolveAnkiConnectUrl({
				ankiConnectUrl: '  http://localhost:9999  ',
				profiles: DEFAULT_SETTINGS.profiles,
				activeProfileId: DEFAULT_SETTINGS.activeProfileId,
				generateWithAiFields: {},
				textProviders: [],
				activeTextProviderId: '',
				imageProviders: [],
				activeImageProviderId: '',
			}),
		).toBe('http://localhost:9999');
	});
});

describe('fieldConfigKey', () => {
	it('produces the same key for the same deck+model', () => {
		expect(fieldConfigKey('Japanese', 'Basic')).toBe(
			fieldConfigKey('Japanese', 'Basic'),
		);
	});

	it('produces different keys for different decks', () => {
		expect(fieldConfigKey('Japanese', 'Basic')).not.toBe(
			fieldConfigKey('Spanish', 'Basic'),
		);
	});

	it('produces different keys for different models', () => {
		expect(fieldConfigKey('Japanese', 'Basic')).not.toBe(
			fieldConfigKey('Japanese', 'Cloze'),
		);
	});

	it('does not collide when a "::" subdeck separator could make a naive join ambiguous', () => {
		// A plain `${deck}::${model}` join would make these two pairs indistinguishable.
		expect(fieldConfigKey('Japanese::N2', 'Basic')).not.toBe(
			fieldConfigKey('Japanese', 'N2::Basic'),
		);
	});
});

const noSecrets = () => null;

const textConfig: TextProviderConfig = {
	id: 't1',
	name: 'Local',
	type: 'openai-compatible' as const,
	baseUrl: ' http://localhost:11434/v1 ',
	apiKeySource: 'manual' as const,
	apiKey: '',
	apiKeySecretId: '',
	model: 'llama3.1',
};

describe('text provider settings', () => {
	it('defaults to no providers and none active', async () => {
		const { plugin } = fakePlugin(null);
		const settings = await loadSettings(plugin);

		expect(settings.textProviders).toEqual([]);
		expect(settings.activeTextProviderId).toBe('');
	});

	it('keeps saved providers and the active id', async () => {
		const { plugin } = fakePlugin({
			textProviders: [textConfig],
			activeTextProviderId: 't1',
		});
		const settings = await loadSettings(plugin);

		expect(settings.textProviders).toEqual([textConfig]);
		expect(settings.activeTextProviderId).toBe('t1');
	});

	it('resets an active id that matches no provider', async () => {
		const { plugin } = fakePlugin({
			textProviders: [textConfig],
			activeTextProviderId: 'gone',
		});

		expect((await loadSettings(plugin)).activeTextProviderId).toBe('');
	});

	it('does not share the providers array with DEFAULT_SETTINGS', async () => {
		const { plugin } = fakePlugin(null);
		(await loadSettings(plugin)).textProviders.push(textConfig);

		expect(DEFAULT_SETTINGS.textProviders).toEqual([]);
	});

	describe('getActiveTextConfig', () => {
		const withActive = (
			over: Partial<typeof textConfig> = {},
			active = 't1',
		) => ({
			...DEFAULT_SETTINGS,
			textProviders: [{ ...textConfig, ...over }],
			activeTextProviderId: active,
		});

		it('is null when none is active', () => {
			expect(
				getActiveTextConfig(withActive({}, ''), noSecrets),
			).toBeNull();
		});

		it('is null while Base URL or Model is missing', () => {
			expect(
				getActiveTextConfig(withActive({ baseUrl: ' ' }), noSecrets),
			).toBeNull();
			expect(
				getActiveTextConfig(withActive({ model: '' }), noSecrets),
			).toBeNull();
		});

		it('returns the trimmed adapter config for the active provider', () => {
			expect(
				getActiveTextConfig(
					withActive({ apiKey: ' test-key ' }),
					noSecrets,
				),
			).toEqual({
				type: 'openai-compatible',
				baseUrl: 'http://localhost:11434/v1',
				apiKey: 'test-key',
				model: 'llama3.1',
			});
		});
	});

	describe('keychain API key', () => {
		const keychain = {
			apiKeySource: 'keychain' as const,
			apiKeySecretId: 'my-key',
			apiKey: 'ignored',
		};
		const active = (over: Partial<typeof textConfig>) => ({
			...DEFAULT_SETTINGS,
			textProviders: [{ ...textConfig, ...over }],
			activeTextProviderId: 't1',
		});

		it('reads the key from the keychain at call time, not the stored one', () => {
			let secret: string | null = 'first-secret';
			const get = () => secret;
			expect(getActiveTextConfig(active(keychain), get)?.apiKey).toBe(
				'first-secret',
			);
			secret = 'rotated-secret';
			expect(getActiveTextConfig(active(keychain), get)?.apiKey).toBe(
				'rotated-secret',
			);
		});

		it('uses an empty key when the secret is missing', () => {
			expect(
				getActiveTextConfig(active(keychain), noSecrets)?.apiKey,
			).toBe('');
		});

		it('never consults the keychain for a manual key', () => {
			const get = vi.fn(() => 'nope');
			expect(
				getActiveTextConfig(active({ apiKey: 'typed' }), get)?.apiKey,
			).toBe('typed');
			expect(get).not.toHaveBeenCalled();
		});

		it('migrates configs saved before the keychain option to manual', async () => {
			const {
				apiKeySource: _s,
				apiKeySecretId: _i,
				...legacy
			} = textConfig;
			const { plugin } = fakePlugin({
				textProviders: [legacy],
				activeTextProviderId: 't1',
			});
			const loaded = await loadSettings(plugin);

			expect(loaded.textProviders[0]).toMatchObject({
				apiKeySource: 'manual',
				apiKeySecretId: '',
			});
		});
	});
});
const imageConfig: ImageProviderConfig = {
	id: 'i1',
	name: 'Local SD',
	type: 'automatic1111',
	baseUrl: ' http://localhost:7860 ',
	apiKeySource: 'manual',
	apiKey: '',
	apiKeySecretId: '',
	model: '',
	negativePrompt: ' blurry ',
};

describe('image provider settings', () => {
	it('defaults to no providers and none active', async () => {
		const { plugin } = fakePlugin(null);
		const settings = await loadSettings(plugin);

		expect(settings.imageProviders).toEqual([]);
		expect(settings.activeImageProviderId).toBe('');
	});

	it('keeps saved providers, resets a stale active id and migrates a missing key source', async () => {
		const { apiKeySource: _s, apiKeySecretId: _i, ...legacy } = imageConfig;
		const kept = await loadSettings(
			fakePlugin({
				imageProviders: [legacy],
				activeImageProviderId: 'i1',
			}).plugin,
		).then((s) => s);
		expect(kept.activeImageProviderId).toBe('i1');
		expect(kept.imageProviders[0]).toMatchObject({
			apiKeySource: 'manual',
			apiKeySecretId: '',
		});

		const stale = await loadSettings(
			fakePlugin({
				imageProviders: [imageConfig],
				activeImageProviderId: 'gone',
			}).plugin,
		);
		expect(stale.activeImageProviderId).toBe('');
	});

	it('does not share the providers array with DEFAULT_SETTINGS', async () => {
		(await loadSettings(fakePlugin(null).plugin)).imageProviders.push(
			imageConfig,
		);

		expect(DEFAULT_SETTINGS.imageProviders).toEqual([]);
	});

	describe('getActiveImageConfig', () => {
		const active = (over: Partial<ImageProviderConfig>, id = 'i1') => ({
			...DEFAULT_SETTINGS,
			imageProviders: [{ ...imageConfig, ...over }],
			activeImageProviderId: id,
		});

		it('is null when none is active or the Base URL is missing', () => {
			expect(getActiveImageConfig(active({}, ''), noSecrets)).toBeNull();
			expect(
				getActiveImageConfig(active({ baseUrl: ' ' }), noSecrets),
			).toBeNull();
		});

		it('needs a model for OpenAI-compatible but not for Automatic1111', () => {
			expect(getActiveImageConfig(active({}), noSecrets)).not.toBeNull();
			expect(
				getActiveImageConfig(
					active({ type: 'openai-compatible', model: '' }),
					noSecrets,
				),
			).toBeNull();
		});

		it('returns trimmed adapter config including the negative prompt', () => {
			expect(getActiveImageConfig(active({}), noSecrets)).toEqual({
				type: 'automatic1111',
				baseUrl: 'http://localhost:7860',
				apiKey: '',
				model: '',
				negativePrompt: 'blurry',
			});
		});

		it('reads a keychain key at call time', () => {
			const cfg = active({
				type: 'openai-compatible',
				model: 'm',
				apiKeySource: 'keychain',
				apiKeySecretId: 'my-key',
				apiKey: 'ignored',
			});
			expect(getActiveImageConfig(cfg, () => 'test-secret')?.apiKey).toBe(
				'test-secret',
			);
		});
	});
});
