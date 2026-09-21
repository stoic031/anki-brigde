import { Notice, Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { isLocalUrl } from '../providers/text/openaiCompatible';
import type { TextProviderConfig } from '../settings';
import { isValidUrl } from '../utils/validation';

const TYPE_LABELS: Record<TextProviderConfig['type'], string> = {
	'openai-compatible': 'OpenAI-compatible',
	anthropic: 'Anthropic',
};

// Suggestions only — the Model field stays free text (docs/design/06-settings.md §6.2).
const URL_HINTS: Record<TextProviderConfig['type'], string> = {
	'openai-compatible': 'https://openrouter.ai/api/v1',
	anthropic: 'https://api.anthropic.com',
};
const MODEL_HINTS: Record<TextProviderConfig['type'], string[]> = {
	'openai-compatible': ['gpt-4o-mini', 'llama3.1'],
	anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-5'],
};

// docs/design/06-settings.md §6.2 — global list of text provider configs + the active one.
// The active dropdown is also the config being edited below it.
export function renderTextProviderSection(
	containerEl: HTMLElement,
	plugin: AnkiBridgePlugin,
): void {
	const el = containerEl.createDiv({
		cls: 'anki-bridge-settings__text-provider',
	});
	const { settings } = plugin;

	const save = () => plugin.saveSettings();

	const render = () => {
		el.empty();
		new Setting(el).setName('AI text provider').setHeading();
		const active = settings.textProviders.find(
			(p) => p.id === settings.activeTextProviderId,
		);

		new Setting(el)
			.setName('Active provider')
			.setDesc(
				'Used to fill fields and write image prompts. None means no AI calls.',
			)
			.addDropdown((dropdown) => {
				dropdown.addOption('', 'None');
				for (const p of settings.textProviders)
					dropdown.addOption(p.id, p.name);
				dropdown.setValue(active?.id ?? '').onChange(async (value) => {
					settings.activeTextProviderId = value;
					await save();
					render();
				});
			})
			.addButton((button) =>
				button.setButtonText('Add').onClick(async () => {
					const config: TextProviderConfig = {
						id: crypto.randomUUID(),
						name: uniqueName(
							settings.textProviders,
							'New provider',
						),
						type: 'openai-compatible',
						baseUrl: '',
						apiKey: '',
						model: '',
					};
					settings.textProviders.push(config);
					settings.activeTextProviderId = config.id;
					await save();
					render();
				}),
			)
			.addButton((button) =>
				button
					.setButtonText('Delete')
					.setWarning()
					.setDisabled(!active)
					.onClick(async () => {
						settings.textProviders = settings.textProviders.filter(
							(p) => p.id !== settings.activeTextProviderId,
						);
						settings.activeTextProviderId = '';
						await save();
						render();
					}),
			);

		if (active) renderEditor(el, active, save, render);
	};

	render();
}

function renderEditor(
	el: HTMLElement,
	config: TextProviderConfig,
	save: () => Promise<void>,
	render: () => void,
): void {
	new Setting(el).setName('Name').addText((text) => {
		text.setValue(config.name);
		// DOM `change` (not onChange) so a re-render doesn't steal focus mid-typing.
		text.inputEl.addEventListener('change', () => {
			void (async () => {
				const name = text.getValue().trim();
				if (name === '') {
					new Notice('❌ Name cannot be empty.');
					text.setValue(config.name);
					return;
				}
				config.name = name;
				await save();
				render();
			})();
		});
	});

	new Setting(el).setName('Type').addDropdown((dropdown) => {
		for (const [value, label] of Object.entries(TYPE_LABELS)) {
			dropdown.addOption(value, label);
		}
		dropdown.setValue(config.type).onChange(async (value) => {
			config.type = value as TextProviderConfig['type'];
			await save();
			render();
		});
	});

	new Setting(el)
		.setName('Base URL')
		.setDesc(
			`For example ${URL_HINTS[config.type]} or http://localhost:11434/v1`,
		)
		.addText((text) => {
			text.setPlaceholder(URL_HINTS[config.type]).setValue(
				config.baseUrl,
			);
			text.inputEl.addEventListener('change', () => {
				void (async () => {
					const url = text.getValue().trim();
					if (url !== '' && !isValidUrl(url)) {
						new Notice(
							'❌ Invalid URL. Please check the base URL.',
						);
						text.setValue(config.baseUrl);
						return;
					}
					config.baseUrl = url;
					await save();
					render();
				})();
			});
		});

	new Setting(el)
		.setName('API key')
		.setDesc(
			'Optional for local endpoints. Stored in this plugin’s data file.',
		)
		.addText((text) => {
			text.inputEl.type = 'password';
			text.setValue(config.apiKey).onChange(async (value) => {
				config.apiKey = value.trim();
				await save();
			});
		});

	new Setting(el)
		.setName('Model')
		.setDesc('Type any model name; the list only suggests common ones.')
		.addText((text) => {
			const listId = `anki-bridge-models-${config.id}`;
			text.inputEl.setAttribute('list', listId);
			const list = el.createEl('datalist', { attr: { id: listId } });
			for (const model of MODEL_HINTS[config.type]) {
				list.createEl('option', { attr: { value: model } });
			}
			text.setValue(config.model).onChange(async (value) => {
				config.model = value.trim();
				await save();
			});
		});

	const local = isLocalUrl(config.baseUrl);
	el.createDiv({
		cls: `anki-bridge-provider-badge ${local ? 'is-local' : 'is-cloud'}`,
		text: local
			? 'Local: requests stay on your machine.'
			: 'Cloud: your note text and API key are sent to this URL.',
	});
}

function uniqueName(list: TextProviderConfig[], base: string): string {
	let name = base;
	for (let n = 2; list.some((p) => p.name === name); n++)
		name = `${base} ${n}`;
	return name;
}
