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
	}

	async saveSettings(): Promise<void> {
		await saveSettings(this, this.settings);
	}

	onunload(): void {}
}
