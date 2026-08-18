import type { App } from 'obsidian';
import { Notice, PluginSettingTab, Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_ANKI_CONNECT_URL } from '../utils/constants';
import { isValidUrl } from '../utils/validation';

export class AnkiBridgeSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: AnkiBridgePlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		this.containerEl.empty();
		renderConnectionSection(this.containerEl, this.plugin);
	}
}

// docs/design/06-settings.md §6.1
export function renderConnectionSection(
	containerEl: HTMLElement,
	plugin: AnkiBridgePlugin,
): void {
	new Setting(containerEl)
		.setName('AnkiConnect URL')
		.setDesc(`Leave blank to use ${DEFAULT_ANKI_CONNECT_URL}.`)
		.addText((text) =>
			text
				.setPlaceholder(DEFAULT_ANKI_CONNECT_URL)
				.setValue(plugin.settings.ankiConnectUrl)
				.onChange(async (value) => {
					const trimmed = value.trim();
					if (trimmed !== '' && !isValidUrl(trimmed)) {
						new Notice(
							'❌ Invalid URL. Please check the AnkiConnect URL.',
						);
						return;
					}
					plugin.settings.ankiConnectUrl = trimmed;
					await plugin.saveSettings();
				}),
		);
}
