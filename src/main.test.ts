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

const { loadSettings, saveSettings, getActiveTextConfig } = vi.hoisted(() => ({
	loadSettings: vi.fn().mockResolvedValue({}),
	getActiveTextConfig: vi.fn().mockReturnValue(null),
	saveSettings: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./settings', () => ({ loadSettings, saveSettings, getActiveTextConfig }));

const { runQuickCapture } = vi.hoisted(() => ({
	runQuickCapture: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./note/quickCapture', () => ({ runQuickCapture }));

const { runCreateNote } = vi.hoisted(() => ({
	runCreateNote: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./note/createNote', () => ({ runCreateNote }));

vi.mock('./ui/settingsTab', () => ({ AnkiBridgeSettingTab: vi.fn() }));

const { registerSidebarView, revealSidebarView } = vi.hoisted(() => ({
	registerSidebarView: vi.fn(),
	revealSidebarView: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./ui/sidebarView', () => ({ registerSidebarView, revealSidebarView }));

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

	it("delegates the command's callback to runQuickCapture", async () => {
		const plugin = new AnkiBridgePlugin(
			{} as App,
			{} as PluginManifest,
		);

		await plugin.onload();

		const registeredCommand = addCommandSpy.mock.calls[0]?.[0] as {
			callback: () => void;
		};
		registeredCommand.callback();

		expect(runQuickCapture).toHaveBeenCalledWith(plugin);
	});

	it('registers the create-note command with no default hotkey', async () => {
		const plugin = new AnkiBridgePlugin(
			{} as App,
			{} as PluginManifest,
		);

		await plugin.onload();

		expect(addCommandSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'create-note',
				name: 'Create new note',
			}),
		);
		const registeredCommand = addCommandSpy.mock.calls[1]?.[0] as Record<
			string,
			unknown
		>;
		expect(registeredCommand.hotkeys).toBeUndefined();
	});

	it("delegates the create-note command's callback to runCreateNote", async () => {
		const plugin = new AnkiBridgePlugin(
			{} as App,
			{} as PluginManifest,
		);

		await plugin.onload();

		const registeredCommand = addCommandSpy.mock.calls[1]?.[0] as {
			callback: () => void;
		};
		registeredCommand.callback();

		expect(runCreateNote).toHaveBeenCalledWith(plugin);
	});

	it('registers the open-deck-model-selector command with no default hotkey', async () => {
		const plugin = new AnkiBridgePlugin(
			{} as App,
			{} as PluginManifest,
		);

		await plugin.onload();

		expect(addCommandSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'open-deck-model-selector',
				name: 'Open Deck & Model Selector',
			}),
		);
		const registeredCommand = addCommandSpy.mock.calls[2]?.[0] as Record<
			string,
			unknown
		>;
		expect(registeredCommand.hotkeys).toBeUndefined();
	});

	it("delegates the open-deck-model-selector command's callback to revealSidebarView", async () => {
		const plugin = new AnkiBridgePlugin(
			{} as App,
			{} as PluginManifest,
		);

		await plugin.onload();

		const registeredCommand = addCommandSpy.mock.calls[2]?.[0] as {
			callback: () => void;
		};
		registeredCommand.callback();

		expect(revealSidebarView).toHaveBeenCalledWith(plugin.app);
	});

	it('registers the sidebar view', async () => {
		const plugin = new AnkiBridgePlugin(
			{} as App,
			{} as PluginManifest,
		);

		await plugin.onload();

		expect(registerSidebarView).toHaveBeenCalledWith(plugin);
	});

	it('exposes a ProviderManager that builds nothing until asked and reads config at call time', async () => {
		const plugin = new AnkiBridgePlugin({} as App, {} as PluginManifest);
		plugin.app = {
			secretStorage: { getSecret: (id: string) => (id === 'my-key' ? 'test-secret' : null) },
		} as unknown as App;
		await plugin.onload();
		expect(getActiveTextConfig).not.toHaveBeenCalled();

		expect(plugin.providers.getTextProvider()).toBeNull();
		expect(getActiveTextConfig).toHaveBeenCalledTimes(1);
		// The lookup handed to settings reads Obsidian's keychain.
		const getSecret = getActiveTextConfig.mock.calls[0]?.[1] as (id: string) => string | null;
		expect(getSecret('my-key')).toBe('test-secret');

		getActiveTextConfig.mockReturnValue({
			type: 'openai-compatible',
			baseUrl: 'http://localhost:11434/v1',
			model: 'm',
		});
		expect(plugin.providers.getTextProvider()?.id).toBe('openai-compatible');
		expect(plugin.providers.getImageProvider()).toBeNull();
	});
});
