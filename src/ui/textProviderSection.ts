import type AnkiBridgePlugin from '../main';
import { TEXT_PRESETS } from '../providers/presets';
import type { TextProviderConfig } from '../settings';
import { renderProviderSection } from './providerSection';

// docs/design/06-settings.md §6.2 — Text providers.
export function renderTextProviderSection(
	containerEl: HTMLElement,
	plugin: AnkiBridgePlugin,
): void {
	renderProviderSection<TextProviderConfig>(containerEl, plugin, {
		cssClass: 'anki-bridge-settings__text-provider',
		heading: 'AI text provider',
		activeDesc:
			'Used to fill fields and write image prompts. None means no AI calls.',
		defaultType: 'openai',
		read: (s) => ({
			list: s.textProviders,
			activeId: s.activeTextProviderId,
		}),
		write: (s, list, activeId) => {
			s.textProviders = list;
			s.activeTextProviderId = activeId;
		},
		kind: { kind: 'text', presets: TEXT_PRESETS, sends: 'note text' },
	});
}
