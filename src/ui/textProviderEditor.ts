import { Notice, SecretComponent, Setting } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { listModels } from '../providers/text/listModels';
import { isLocalUrl } from '../providers/text/openaiCompatible';
import { toProviderConfig, type TextProviderConfig } from '../settings';
import { ProviderError } from '../types';
import { isValidUrl } from '../utils/validation';

const TYPE_LABELS: Record<TextProviderConfig['type'], string> = {
	'openai-compatible': 'OpenAI-compatible',
	anthropic: 'Anthropic',
};
const URL_HINTS: Record<TextProviderConfig['type'], string> = {
	'openai-compatible': 'https://openrouter.ai/api/v1',
	anthropic: 'https://api.anthropic.com',
};

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

export function renderEditor(
	el: HTMLElement,
	plugin: AnkiBridgePlugin,
	config: TextProviderConfig,
	save: () => Promise<void>,
	render: () => void,
): void {
	// Saving a connection detail invalidates the model list and refetches it.
	const commitConnection = async () => {
		await save();
		await refreshModels(plugin, config, render);
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
		for (const [value, label] of Object.entries(TYPE_LABELS)) {
			dropdown.addOption(value, label);
		}
		dropdown.setValue(config.type).onChange(async (value) => {
			config.type = value as TextProviderConfig['type'];
			await commitConnection();
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
					await commitConnection();
				})();
			});
		});

	renderApiKeyRows(el, plugin, config, save, render, commitConnection);
	renderModelRow(el, plugin, config, save, render);

	const local = isLocalUrl(config.baseUrl);
	el.createDiv({
		cls: `anki-bridge-provider-badge ${local ? 'is-local' : 'is-cloud'}`,
		text: local
			? 'Local: requests stay on your machine.'
			: 'Cloud: your note text and API key are sent to this URL.',
	});
}

function renderApiKeyRows(
	el: HTMLElement,
	plugin: AnkiBridgePlugin,
	config: TextProviderConfig,
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
				void refreshModels(plugin, config, render);
			});
		});
}

function renderModelRow(
	el: HTMLElement,
	plugin: AnkiBridgePlugin,
	config: TextProviderConfig,
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
			.onClick(() => refreshModels(plugin, config, render)),
	);
}

async function refreshModels(
	plugin: AnkiBridgePlugin,
	config: TextProviderConfig,
	render: () => void,
): Promise<void> {
	if (config.baseUrl === '' && config.type !== 'anthropic') {
		modelStates.delete(config.id);
		render();
		return;
	}
	modelStates.set(config.id, { loading: true });
	render();
	try {
		const models = await listModels(
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
