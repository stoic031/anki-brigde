import { Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';

// docs/design/06-settings.md §6.2 — global (not per profile): fed into AI Generate as
// context alongside each profile's Learning language (docs/design/02-providers.md §2.4).
export function renderLanguageSection(
	containerEl: HTMLElement,
	plugin: AnkiBridgePlugin,
): void {
	new Setting(containerEl)
		.setName('Your language')
		.setDesc(
			'Used as AI generation context, alongside each profile’s learning language.',
		)
		.addText((text) =>
			text
				.setPlaceholder('E.g. English')
				.setValue(plugin.settings.nativeLanguage)
				.onChange(async (value) => {
					plugin.settings.nativeLanguage = value.trim();
					await plugin.saveSettings();
				}),
		);
}
