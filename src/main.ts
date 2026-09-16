import { Plugin } from 'obsidian';
import { registerControlsBlock } from './note/controlsBlock';
import { runQuickCapture } from './note/quickCapture';
import { runCreateNote } from './note/createNote';
import {
	loadSettings,
	saveSettings,
	type AnkiBridgeSettings,
} from './settings';
import { AnkiBridgeSettingTab } from './ui/settingsTab';
import { registerSidebarView } from './ui/sidebarView';

export default class AnkiBridgePlugin extends Plugin {
	settings!: AnkiBridgeSettings;

	async onload(): Promise<void> {
		this.settings = await loadSettings(this);
		this.addSettingTab(new AnkiBridgeSettingTab(this.app, this));
		registerControlsBlock(this);
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
	}

	async saveSettings(): Promise<void> {
		await saveSettings(this, this.settings);
	}

	onunload(): void {}
}
