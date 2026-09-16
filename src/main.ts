import { Plugin } from 'obsidian';
import { registerControlsBlock } from './note/controlsBlock';
import {
	loadSettings,
	saveSettings,
	type AnkiBridgeSettings,
} from './settings';
import { AnkiBridgeSettingTab } from './ui/settingsTab';

export default class AnkiBridgePlugin extends Plugin {
	settings!: AnkiBridgeSettings;

	async onload(): Promise<void> {
		this.settings = await loadSettings(this);
		this.addSettingTab(new AnkiBridgeSettingTab(this.app, this));
		registerControlsBlock(this);

		this.addCommand({
			id: 'create-note-from-selection',
			name: 'Create note from selection',
			// Reads selection / resolves Deck-Model-Folder / creates note: #124-#129, see docs/design/03-note.md §3.7
			callback: () => {},
		});
	}

	async saveSettings(): Promise<void> {
		await saveSettings(this, this.settings);
	}

	onunload(): void {}
}
