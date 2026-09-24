import type { App, ButtonComponent } from 'obsidian';
import { Notice, PluginSettingTab, Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { DEFAULT_ANKI_CONNECT_URL } from '../utils/constants';
import { isValidUrl } from '../utils/validation';
import { resolveAnkiConnectUrl } from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { renderProfilesSection, type ProfilesSection } from './profilesSection';
import { renderLanguageSection } from './languageSection';
import { renderImageProviderSection } from './imageProviderSection';
import { renderTextProviderSection } from './textProviderSection';
import { renderMediaSection } from './mediaSection';
import { renderSyncSection } from './syncSection';
import { renderCollapsibleSection } from './collapsibleSection';
import { toastError, toastSuccess } from './toast';

export class AnkiBridgeSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: AnkiBridgePlugin,
	) {
		super(app, plugin);
	}

	private profiles?: ProfilesSection;

	display(): void {
		this.containerEl.empty();

		const connectionBody = renderCollapsibleSection(
			this.containerEl,
			'Connection & profiles',
			true,
		);
		this.profiles = renderConnectionSection(connectionBody, this.plugin);

		const aiBody = renderCollapsibleSection(
			this.containerEl,
			'AI providers',
			false,
		);
		renderLanguageSection(aiBody, this.plugin);
		renderTextProviderSection(aiBody, this.plugin);
		renderImageProviderSection(aiBody, this.plugin);

		const advancedBody = renderCollapsibleSection(
			this.containerEl,
			'Sync & media',
			false,
		);
		renderSyncSection(advancedBody, this.plugin);
		renderMediaSection(advancedBody, this.plugin);
	}

	hide(): void {
		this.profiles?.dispose();
		this.profiles = undefined;
	}
}

// docs/design/06-settings.md §6.1
export function renderConnectionSection(
	containerEl: HTMLElement,
	plugin: AnkiBridgePlugin,
): ProfilesSection {
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
					() => void handleConnect(plugin, profiles, connectButton),
				);
		});

	const profiles = renderProfilesSection(containerEl, plugin);
	// Load Anki's deck/model names on open so the pickers are full without pressing
	// Connect. Silent on failure — Connect is what reports connection problems.
	void loadAnkiNames(plugin, profiles);
	return profiles;
}

async function loadAnkiNames(
	plugin: AnkiBridgePlugin,
	profiles: ProfilesSection,
): Promise<void> {
	try {
		const client = new AnkiConnectClient(
			resolveAnkiConnectUrl(plugin.settings),
		);
		const [deckNames, modelNames] = await Promise.all([
			client.deckNames(),
			client.modelNames(),
		]);
		profiles.setAnkiNames(deckNames, modelNames);
	} catch {
		// Anki offline: pickers keep showing the saved values.
	}
}

async function handleConnect(
	plugin: AnkiBridgePlugin,
	profiles: ProfilesSection,
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

		profiles.setAnkiNames(deckNames, modelNames);
		toastSuccess('✅ Connected to Anki!');
	} catch {
		toastError(
			'❌ Cannot connect to Anki. Please check URL and AnkiConnect.',
		);
	} finally {
		button.setButtonText('🔗 Connect');
		button.setDisabled(false);
	}
}
