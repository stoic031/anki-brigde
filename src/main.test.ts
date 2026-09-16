import { afterEach, describe, expect, it, vi } from 'vitest';
import type { App, PluginManifest } from 'obsidian';

const { PluginBase, addCommandSpy } = vi.hoisted(() => {
	const addCommandSpy = vi.fn();
	class PluginBase {
		app = {};
		addCommand = addCommandSpy;
		addSettingTab = vi.fn();
	}
	return { PluginBase, addCommandSpy };
});
vi.mock('obsidian', () => ({ Plugin: PluginBase }));

const { loadSettings, saveSettings } = vi.hoisted(() => ({
	loadSettings: vi.fn().mockResolvedValue({}),
	saveSettings: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./settings', () => ({ loadSettings, saveSettings }));

const { registerControlsBlock } = vi.hoisted(() => ({
	registerControlsBlock: vi.fn(),
}));
vi.mock('./note/controlsBlock', () => ({ registerControlsBlock }));

vi.mock('./ui/settingsTab', () => ({ AnkiBridgeSettingTab: vi.fn() }));

import AnkiBridgePlugin from './main';

describe('AnkiBridgePlugin.onload', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('registers the create-note-from-selection command with no default hotkey', async () => {
		const plugin = new AnkiBridgePlugin(
			{} as App,
			{} as PluginManifest,
		);

		await plugin.onload();

		expect(addCommandSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'create-note-from-selection',
				name: 'Create note from selection',
			}),
		);
		const registeredCommand = addCommandSpy.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(registeredCommand.hotkeys).toBeUndefined();
	});
});
