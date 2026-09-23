import { Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';

// docs/design/06-settings.md §6.3
export function renderSyncSection(
	containerEl: HTMLElement,
	plugin: AnkiBridgePlugin,
): void {
	new Setting(containerEl)
		.setName('Auto sync on save')
		.setDesc(
			'Sync the active note to Anki automatically whenever you save it.',
		)
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.autoSyncOnSave)
				.onChange(async (value) => {
					plugin.settings.autoSyncOnSave = value;
					await plugin.saveSettings();
				}),
		);
}
