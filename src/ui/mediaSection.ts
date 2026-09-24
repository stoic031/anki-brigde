import { Notice, Setting } from 'obsidian';
import type VocabWeavePlugin from '../main';
import { DEFAULT_MEDIA_PREFIX } from '../utils/constants';
import { isValidMediaPrefix } from '../utils/validation';

// docs/design/06-settings.md §6.4
export function renderMediaSection(
	containerEl: HTMLElement,
	plugin: VocabWeavePlugin,
): void {
	new Setting(containerEl)
		.setName('Media prefix')
		.setDesc(
			"Prepended to generated media filenames so Anki doesn't delete them when checking media.",
		)
		.addText((text) =>
			text
				.setPlaceholder(DEFAULT_MEDIA_PREFIX)
				.setValue(plugin.settings.mediaPrefix)
				.onChange(async (value) => {
					const trimmed = value.trim();
					if (!isValidMediaPrefix(trimmed)) {
						new Notice(
							'❌ Invalid prefix. It cannot be empty or contain special/path characters.',
						);
						return;
					}
					plugin.settings.mediaPrefix = trimmed;
					await plugin.saveSettings();
				}),
		);
}
