import type { App, ButtonComponent, DropdownComponent } from 'obsidian';
import { Notice, PluginSettingTab, Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_ANKI_CONNECT_URL } from '../utils/constants';
import { isValidUrl } from '../utils/validation';
import { resolveAnkiConnectUrl } from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { toastError, toastSuccess } from './toast';

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

const DROPDOWNS_HIDDEN_CLASS = 'anki-bridge-settings__hidden';

// docs/design/06-settings.md §6.1
export function renderConnectionSection(
	containerEl: HTMLElement,
	plugin: AnkiBridgePlugin,
): void {
	let deckDropdown!: DropdownComponent;
	let modelDropdown!: DropdownComponent;
	let connectButton!: ButtonComponent;

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
		)
		.addButton((button) => {
			connectButton = button;
			button
				.setButtonText('🔗 Connect')
				.onClick(
					() =>
						void handleConnect(
							plugin,
							dropdownsEl,
							deckDropdown,
							modelDropdown,
							connectButton,
						),
				);
		});

	const dropdownsEl = containerEl.createDiv({
		cls: `anki-bridge-settings__dropdowns ${DROPDOWNS_HIDDEN_CLASS}`,
	});

	new Setting(dropdownsEl).setName('Default deck').addDropdown((dropdown) => {
		deckDropdown = dropdown;
		dropdown.onChange(async (value) => {
			plugin.settings.defaultDeck = value;
			await plugin.saveSettings();
		});
	});
	new Setting(dropdownsEl)
		.setName('Default model')
		.addDropdown((dropdown) => {
			modelDropdown = dropdown;
			dropdown.onChange(async (value) => {
				plugin.settings.defaultModel = value;
				await plugin.saveSettings();
			});
		});
}

async function handleConnect(
	plugin: AnkiBridgePlugin,
	dropdownsEl: HTMLElement,
	deckDropdown: DropdownComponent,
	modelDropdown: DropdownComponent,
	button: ButtonComponent,
): Promise<void> {
	button.setDisabled(true);
	button.setButtonText('⏳ Connecting...');

	try {
		const client = new AnkiConnectClient(
			resolveAnkiConnectUrl(plugin.settings),
		);
		const [deckNames, modelNames] = await Promise.all([
			client.deckNames(),
			client.modelNames(),
		]);

		deckDropdown.selectEl.empty();
		for (const name of deckNames) deckDropdown.addOption(name, name);
		if (
			plugin.settings.defaultDeck &&
			deckNames.includes(plugin.settings.defaultDeck)
		) {
			deckDropdown.setValue(plugin.settings.defaultDeck);
		}

		modelDropdown.selectEl.empty();
		for (const name of modelNames) modelDropdown.addOption(name, name);
		if (
			plugin.settings.defaultModel &&
			modelNames.includes(plugin.settings.defaultModel)
		) {
			modelDropdown.setValue(plugin.settings.defaultModel);
		}

		dropdownsEl.toggleClass(DROPDOWNS_HIDDEN_CLASS, false);
		toastSuccess('✅ Connected to Anki!');
	} catch {
		dropdownsEl.toggleClass(DROPDOWNS_HIDDEN_CLASS, true);
		toastError(
			'❌ Cannot connect to Anki. Please check URL and AnkiConnect.',
		);
	} finally {
		button.setButtonText('🔗 Connect');
		button.setDisabled(false);
	}
}
