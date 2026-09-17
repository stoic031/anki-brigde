import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	fieldConfigKey,
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
			ankiConnectUrl: 'http://localhost:9999',
			defaultDeck: '',
			defaultModel: '',
			defaultFolder: '',
			currentDeck: '',
			currentModel: '',
			currentFolder: '',
			generateWithAiFields: {},
		});
	});

	it('preserves a saved defaultFolder', async () => {
		const { plugin } = fakePlugin({ defaultFolder: 'Anki Notes' });

		await expect(loadSettings(plugin)).resolves.toEqual({
			...DEFAULT_SETTINGS,
			defaultFolder: 'Anki Notes',
		});
	});
});

describe('saveSettings', () => {
	it('writes the settings object via plugin.saveData', async () => {
		const { plugin, saveData } = fakePlugin(null);
		const settings: AnkiBridgeSettings = {
			ankiConnectUrl: 'http://localhost:1234',
			defaultDeck: '',
			defaultModel: '',
			defaultFolder: '',
			currentDeck: '',
			currentModel: '',
			currentFolder: '',
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
				defaultDeck: '',
				defaultModel: '',
				defaultFolder: '',
				currentDeck: '',
				currentModel: '',
				currentFolder: '',
				generateWithAiFields: {},
			}),
		).toBe(DEFAULT_ANKI_CONNECT_URL);
	});

	it('returns the default when the setting is whitespace only', () => {
		expect(
			resolveAnkiConnectUrl({
				ankiConnectUrl: '   ',
				defaultDeck: '',
				defaultModel: '',
				defaultFolder: '',
				currentDeck: '',
				currentModel: '',
				currentFolder: '',
				generateWithAiFields: {},
			}),
		).toBe(DEFAULT_ANKI_CONNECT_URL);
	});

	it('returns the trimmed value when set', () => {
		expect(
			resolveAnkiConnectUrl({
				ankiConnectUrl: '  http://localhost:9999  ',
				defaultDeck: '',
				defaultModel: '',
				defaultFolder: '',
				currentDeck: '',
				currentModel: '',
				currentFolder: '',
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

// Unlike fakePlugin() above, this actually pipes through JSON.stringify/parse — matching
// Obsidian's real on-disk loadData/saveData — so these tests exercise real serialization
// instead of a no-op mock passing the same object reference back.
function fakeDiskPlugin(): { plugin: Plugin } {
	let disk: string | undefined;
	const plugin = {
		loadData: vi.fn().mockImplementation(() => {
			return Promise.resolve(disk === undefined ? null : JSON.parse(disk));
		}),
		saveData: vi.fn().mockImplementation((data: unknown) => {
			disk = JSON.stringify(data);
			return Promise.resolve();
		}),
	} as unknown as Plugin;
	return { plugin };
}

describe('persistence round-trip', () => {
	it('round-trips a full settings snapshot with multiple Deck+Model field-mapping pairs through save then load', async () => {
		const pairA = fieldConfigKey('Japanese::N2', 'Basic');
		const pairB = fieldConfigKey('Spanish', 'Cloze');
		const settings: AnkiBridgeSettings = {
			ankiConnectUrl: 'http://localhost:9999',
			defaultDeck: 'Japanese::N2',
			defaultModel: 'Basic',
			defaultFolder: 'Anki Notes',
			currentDeck: 'Spanish',
			currentModel: 'Cloze',
			currentFolder: 'Vocab',
			generateWithAiFields: {
				[pairA]: ['Meaning', 'Furigana'],
				[pairB]: ['Meaning'],
			},
		};
		const { plugin } = fakeDiskPlugin();

		await saveSettings(plugin, settings);
		const loaded = await loadSettings(plugin);

		expect(loaded).toEqual(settings);
		expect(loaded.generateWithAiFields[pairA]).toEqual(['Meaning', 'Furigana']);
		expect(loaded.generateWithAiFields[pairB]).toEqual(['Meaning']);
	});

	it('preserves an explicitly empty field list separately from a pair that was never configured', async () => {
		const configuredEmpty = fieldConfigKey('Japanese', 'Basic');
		const settings: AnkiBridgeSettings = {
			...DEFAULT_SETTINGS,
			generateWithAiFields: { [configuredEmpty]: [] },
		};
		const { plugin } = fakeDiskPlugin();

		await saveSettings(plugin, settings);
		const loaded = await loadSettings(plugin);

		// Explicitly configured (all fields unticked) — key present, empty array.
		expect(loaded.generateWithAiFields[configuredEmpty]).toEqual([]);
		expect(configuredEmpty in loaded.generateWithAiFields).toBe(true);
		// Never configured at all for this pair — key absent, not merely an empty array.
		const neverConfigured = fieldConfigKey('Spanish', 'Cloze');
		expect(loaded.generateWithAiFields[neverConfigured]).toBeUndefined();
		expect(neverConfigured in loaded.generateWithAiFields).toBe(false);
	});
});
