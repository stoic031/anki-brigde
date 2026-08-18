import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	loadSettings,
	resolveAnkiConnectUrl,
	saveSettings,
	type AnkiBridgeSettings,
} from './settings';
import { DEFAULT_ANKI_CONNECT_URL } from './utils/constants';

// Returns the spies as plain locals (not read back off `plugin`) so assertions like
// `expect(saveData).toHaveBeenCalledWith(...)` don't trip @typescript-eslint/unbound-method.
function fakePlugin(loadedData: unknown): { plugin: Plugin; saveData: ReturnType<typeof vi.fn> } {
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
		const { plugin } = fakePlugin({ ankiConnectUrl: 'http://localhost:9999' });

		await expect(loadSettings(plugin)).resolves.toEqual({
			ankiConnectUrl: 'http://localhost:9999',
		});
	});
});

describe('saveSettings', () => {
	it('writes the settings object via plugin.saveData', async () => {
		const { plugin, saveData } = fakePlugin(null);
		const settings: AnkiBridgeSettings = {
			ankiConnectUrl: 'http://localhost:1234',
		};

		await saveSettings(plugin, settings);

		expect(saveData).toHaveBeenCalledWith(settings);
	});
});

describe('resolveAnkiConnectUrl', () => {
	it('returns the default when the setting is blank', () => {
		expect(resolveAnkiConnectUrl({ ankiConnectUrl: '' })).toBe(
			DEFAULT_ANKI_CONNECT_URL,
		);
	});

	it('returns the default when the setting is whitespace only', () => {
		expect(resolveAnkiConnectUrl({ ankiConnectUrl: '   ' })).toBe(
			DEFAULT_ANKI_CONNECT_URL,
		);
	});

	it('returns the trimmed value when set', () => {
		expect(
			resolveAnkiConnectUrl({
				ankiConnectUrl: '  http://localhost:9999  ',
			}),
		).toBe('http://localhost:9999');
	});
});
