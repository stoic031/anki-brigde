import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	fieldConfigKey,
	getActiveProfile,
	loadSettings,
	resolveAnkiConnectUrl,
	saveSettings,
	type AnkiBridgeSettings,
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
