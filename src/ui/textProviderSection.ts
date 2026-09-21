import { Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import type { TextProviderConfig } from '../settings';
import { renderEditor } from './textProviderEditor';

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
						apiKeySource: 'manual',
						apiKey: '',
						apiKeySecretId: '',
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

		if (active) renderEditor(el, plugin, active, save, render);
	};

	render();
}

function uniqueName(list: TextProviderConfig[], base: string): string {
	let name = base;
	for (let n = 2; list.some((p) => p.name === name); n++)
		name = `${base} ${n}`;
	return name;
}
