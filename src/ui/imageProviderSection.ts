import { Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import {
	AUTOMATIC1111_DEFAULT_URL,
	listImageModels,
} from '../providers/image/listModels';
import type { ImageProviderConfig } from '../settings';
import { renderProviderSection } from './providerSection';

// docs/design/06-settings.md §6.2 — Image providers. Same list/active/keychain/model-list
// behavior as Text; Automatic1111 is local, keyless, and picks its own checkpoint.
export function renderImageProviderSection(
	containerEl: HTMLElement,
	plugin: AnkiBridgePlugin,
): void {
	renderProviderSection<ImageProviderConfig>(containerEl, plugin, {
		cssClass: 'anki-bridge-settings__image-provider',
		heading: 'AI image provider',
		activeDesc:
			'Used to generate images for your cards. None means no image generation.',
		defaultType: 'openai-compatible',
		extraDefaults: { negativePrompt: '' },
		read: (s) => ({
			list: s.imageProviders,
			activeId: s.activeImageProviderId,
		}),
		write: (s, list, activeId) => {
			s.imageProviders = list;
			s.activeImageProviderId = activeId;
		},
		kind: {
			typeLabels: {
				'openai-compatible': 'OpenAI-compatible',
				automatic1111: 'Automatic1111 (local)',
			},
			urlHints: {
				'openai-compatible': 'https://api.openai.com/v1',
				automatic1111: AUTOMATIC1111_DEFAULT_URL,
			},
			sends: 'prompts',
			hasApiKey: (type) => type !== 'automatic1111',
			// Pre-fill the local default when switching to Automatic1111; drop it when leaving.
			onTypeChange: (config) => {
				if (config.type === 'automatic1111' && config.baseUrl === '') {
					config.baseUrl = AUTOMATIC1111_DEFAULT_URL;
				} else if (
					config.type !== 'automatic1111' &&
					config.baseUrl === AUTOMATIC1111_DEFAULT_URL
				) {
					config.baseUrl = '';
				}
			},
			listModels: listImageModels,
			extraRows: (el, config, save) => {
				new Setting(el)
					.setName('Negative prompt')
					.setDesc(
						'Things to keep out of the image. Used by providers that support it, such as Automatic1111.',
					)
					.addTextArea((area) => {
						area.setValue(config.negativePrompt);
						area.inputEl.addEventListener('change', () => {
							config.negativePrompt = area.getValue().trim();
							void save();
						});
					});
			},
		},
	});
}
