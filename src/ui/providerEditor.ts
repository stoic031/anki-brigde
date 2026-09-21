import { Notice, SecretComponent, Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { isLocalUrl } from '../providers/text/openaiCompatible';
import type { ProviderConfig } from '../providers/providerManager';
import { toProviderConfig, type ProviderConfigBase } from '../settings';
import { ProviderError } from '../types';
import { isValidUrl } from '../utils/validation';

// What differs between the Text and Image provider lists (docs/design/06-settings.md §6.2).
export type AnyProviderConfig = ProviderConfigBase & { type: string };

export interface ProviderKindSpec<C extends AnyProviderConfig> {
	typeLabels: Record<string, string>;
	urlHints: Record<string, string>; // placeholder + example for the Base URL field
	sends: string; // what leaves the machine, for the Cloud badge ("note text", "prompts")
	allowEmptyUrl?: (type: string) => boolean; // type has a built-in default endpoint
	hasApiKey?: (type: string) => boolean; // default true
	urlExtra?: string; // second example shown in the Base URL description
	onTypeChange?: (config: C) => void; // e.g. pre-fill a local default URL
	listModels: (config: ProviderConfig) => Promise<string[]>;
	extraRows?: (el: HTMLElement, config: C, save: () => Promise<void>) => void;
}

// docs/design/06-settings.md §6.2 — models the endpoint reported, kept in memory for the
// session. Filled only by user actions (edit Base URL/type/key, Refresh), never on open.
interface ModelState {
	loading?: boolean;
	models?: string[];
	error?: string;
}
const modelStates = new Map<string, ModelState>();

// For tests: the cache is module-level, so it would leak between cases.
export const clearModelCache = (): void => modelStates.clear();

export function renderEditor<C extends AnyProviderConfig>(
	el: HTMLElement,
	plugin: AnkiBridgePlugin,
	spec: ProviderKindSpec<C>,
	config: C,
	save: () => Promise<void>,
	render: () => void,
): void {
	// Saving a connection detail invalidates the model list and refetches it.
	const commitConnection = async () => {
		await save();
		await refreshModels(plugin, spec, config, render);
	};

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
		for (const [value, label] of Object.entries(spec.typeLabels)) {
			dropdown.addOption(value, label);
		}
		dropdown.setValue(config.type).onChange(async (value) => {
			config.type = value;
			spec.onTypeChange?.(config);
			await commitConnection();
		});
	});

	new Setting(el)
		.setName('Base URL')
		.setDesc(
			`For example ${spec.urlHints[config.type]}${spec.urlExtra ? ` or ${spec.urlExtra}` : ''}`,
		)
		.addText((text) => {
			text.setPlaceholder(spec.urlHints[config.type] ?? '').setValue(
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
					await commitConnection();
				})();
			});
		});

	if (spec.hasApiKey?.(config.type) ?? true) {
		renderApiKeyRows(
			el,
			plugin,
			spec,
			config,
			save,
			render,
			commitConnection,
		);
	}
	renderModelRow(el, plugin, spec, config, save, render);
	spec.extraRows?.(el, config, save);

	const local = isLocalUrl(config.baseUrl);
	el.createDiv({
		cls: `anki-bridge-provider-badge ${local ? 'is-local' : 'is-cloud'}`,
		text: local
			? 'Local: requests stay on your machine.'
			: `Cloud: your ${spec.sends} and API key are sent to this URL.`,
	});
}

function renderApiKeyRows<C extends AnyProviderConfig>(
	el: HTMLElement,
	plugin: AnkiBridgePlugin,
	spec: ProviderKindSpec<C>,
	config: C,
	save: () => Promise<void>,
	render: () => void,
	commitConnection: () => Promise<void>,
): void {
	new Setting(el)
		.setName('API key source')
		.setDesc('The keychain keeps the key out of this plugin’s data file.')
		.addDropdown((dropdown) => {
			dropdown.addOption('manual', 'Enter manually');
			dropdown.addOption('keychain', 'Obsidian keychain');
			dropdown.setValue(config.apiKeySource).onChange(async (value) => {
				config.apiKeySource =
					value === 'keychain' ? 'keychain' : 'manual';
				await save();
				render();
				await commitConnection();
			});
		});

	if (config.apiKeySource === 'keychain') {
		new Setting(el)
			.setName('API key')
			.setDesc('Choose or create a secret. Optional for local endpoints.')
			.addComponent((controlEl) =>
				new SecretComponent(plugin.app, controlEl)
					.setValue(config.apiKeySecretId)
					.onChange(async (secretId) => {
						config.apiKeySecretId = secretId;
						await commitConnection();
					}),
			);
		return;
	}
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
			// One fetch when the user finishes typing, not one per keystroke.
			text.inputEl.addEventListener('change', () => {
				void refreshModels(plugin, spec, config, render);
			});
		});
}

function renderModelRow<C extends AnyProviderConfig>(
	el: HTMLElement,
	plugin: AnkiBridgePlugin,
	spec: ProviderKindSpec<C>,
	config: C,
	save: () => Promise<void>,
	render: () => void,
): void {
	const state = modelStates.get(config.id) ?? {};
	const models = state.models ?? [];
	const setting = new Setting(el).setName('Model');

	if (state.loading) {
		setting.setDesc('Loading models…');
	} else if (state.error) {
		setting.setDesc(
			`Couldn't load models: ${state.error} Type the model name instead.`,
		);
	} else if (models.length > 0) {
		setting.setDesc(
			`${models.length} models available from this endpoint.`,
		);
	} else {
		setting.setDesc(
			'Enter a base URL, then refresh to list the available models.',
		);
	}

	if (models.length > 0) {
		setting.addDropdown((dropdown) => {
			if (config.model === '') dropdown.addOption('', 'Select a model…');
			// A saved model the endpoint no longer lists still shows.
			const options =
				models.includes(config.model) || config.model === ''
					? models
					: [config.model, ...models];
			for (const id of options) dropdown.addOption(id, id);
			dropdown.setValue(config.model).onChange(async (value) => {
				config.model = value;
				await save();
			});
		});
	} else {
		setting.addText((text) => {
			text.setValue(config.model).onChange(async (value) => {
				config.model = value.trim();
				await save();
			});
		});
	}

	setting.addButton((button) =>
		button
			.setButtonText('Refresh')
			.setDisabled(state.loading === true || config.baseUrl === '')
			.onClick(() => refreshModels(plugin, spec, config, render)),
	);
}

async function refreshModels<C extends AnyProviderConfig>(
	plugin: AnkiBridgePlugin,
	spec: ProviderKindSpec<C>,
	config: C,
	render: () => void,
): Promise<void> {
	if (config.baseUrl === '' && !spec.allowEmptyUrl?.(config.type)) {
		modelStates.delete(config.id);
		render();
		return;
	}
	modelStates.set(config.id, { loading: true });
	render();
	try {
		const models = await spec.listModels(
			toProviderConfig(config, (id) =>
				plugin.app.secretStorage.getSecret(id),
			),
		);
		modelStates.set(config.id, { models });
	} catch (err) {
		const reason =
			err instanceof ProviderError ? err.message : 'unexpected error.';
		modelStates.set(config.id, {
			error: reason.endsWith('.') ? reason : `${reason}.`,
		});
	}
	render();
}
