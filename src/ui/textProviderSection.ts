import type AnkiBridgePlugin from '../main';
import { listModels } from '../providers/text/listModels';
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
		defaultType: 'openai-compatible',
		read: (s) => ({
			list: s.textProviders,
			activeId: s.activeTextProviderId,
		}),
		write: (s, list, activeId) => {
			s.textProviders = list;
			s.activeTextProviderId = activeId;
		},
		kind: {
			typeLabels: {
				'openai-compatible': 'OpenAI-compatible',
				anthropic: 'Anthropic',
			},
			urlHints: {
				'openai-compatible': 'https://openrouter.ai/api/v1',
				anthropic: 'https://api.anthropic.com',
			},
			urlExtra: 'http://localhost:11434/v1',
			sends: 'note text',
			allowEmptyUrl: (type) => type === 'anthropic',
			listModels,
		},
	});
}
