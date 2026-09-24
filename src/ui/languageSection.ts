import type VocabWeavePlugin from '../main';
import { LANGUAGES } from '../utils/constants';
import { renderPicker } from './profilesSection';

// docs/design/06-settings.md §6.2 — global (not per profile): fed into AI Generate as
// context alongside each profile's Learning language (docs/design/02-providers.md §2.4).
export function renderLanguageSection(
	containerEl: HTMLElement,
	plugin: VocabWeavePlugin,
): void {
	renderPicker(
		containerEl,
		'Your language',
		LANGUAGES,
		plugin.settings.nativeLanguage,
		async (v) => {
			plugin.settings.nativeLanguage = v;
			await plugin.saveSettings();
		},
		'Used as AI generation context, alongside each profile’s learning language.',
	);
}
