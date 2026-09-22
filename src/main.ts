import { Plugin } from 'obsidian';
import { ProviderManager } from './providers/providerManager';
import { textFactories } from './providers/text';
import { runQuickCapture } from './note/quickCapture';
import { runCreateNote } from './note/createNote';
import {
	getActiveImageConfig,
	getActiveTextConfig,
	loadSettings,
	saveSettings,
	type AnkiBridgeSettings,
} from './settings';
import { AnkiBridgeSettingTab } from './ui/settingsTab';
import { registerSidebarView, revealSidebarView } from './ui/sidebarView';
import { PROFILE_CHANGED_EVENT } from './utils/constants';

export default class AnkiBridgePlugin extends Plugin {
	settings!: AnkiBridgeSettings;

	// docs/design/02-providers.md §2.3 — providers are built on first use, config read at
	// call time, so settings edits apply without a reload and nothing runs on load.
	readonly providers = new ProviderManager({
		text: {
			factories: textFactories,
			getConfig: () =>
				getActiveTextConfig(this.settings, (id) =>
					this.app.secretStorage.getSecret(id),
				),
		},
		// No image adapters are registered yet (#17): an active image config makes
		// getImageProvider() throw 'no adapter for this provider type'.
		image: {
			factories: {},
			getConfig: () =>
				getActiveImageConfig(this.settings, (id) =>
					this.app.secretStorage.getSecret(id),
				),
		},
	});

	async onload(): Promise<void> {
		this.settings = await loadSettings(this);
		this.addSettingTab(new AnkiBridgeSettingTab(this.app, this));
		registerSidebarView(this);

		this.addCommand({
			id: 'create-note-from-selection',
			name: 'Create note from selection',
			callback: () => void runQuickCapture(this),
		});

		this.addCommand({
			id: 'create-note',
			name: 'Create new note',
			callback: () => void runCreateNote(this),
		});

		this.addCommand({
			id: 'open-deck-model-selector',
			name: 'Open Deck & Model Selector',
			callback: () => void revealSidebarView(this.app),
		});
	}

	async saveSettings(): Promise<void> {
		await saveSettings(this, this.settings);
	}

	// Settings tab and sidebar both re-render their profile selector on this event.
	// Also used after adding/renaming/deleting a profile, since the selector lists them.
	async setActiveProfile(id: string): Promise<void> {
		this.settings.activeProfileId = id;
		await this.saveSettings();
		this.app.workspace.trigger(PROFILE_CHANGED_EVENT);
	}

	onunload(): void {}
}
