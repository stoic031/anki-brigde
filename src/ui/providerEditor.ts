import { Notice, SecretComponent, Setting } from 'obsidian';
import type VocabWeavePlugin from '../main';
import { listModels, type ModelKind } from '../providers/modelLists';
import { presetLabel, type ProviderPreset } from '../providers/presets';
import {
	endpointUrl,
	resolveApiKey,
	type ProviderConfigBase,
} from '../settings';
import { ProviderError } from '../types';
import { isValidUrl } from '../utils/validation';
import {
	refreshWorkflows,
	renderWorkflowRow,
	type WorkflowHolder,
} from './comfyWorkflowRow';

// What differs between the Text and Image provider lists (docs/design/06-settings.md §6.2).
export type AnyProviderConfig = ProviderConfigBase & { type: string };

export interface ProviderKindSpec<C extends AnyProviderConfig> {
	kind: ModelKind;
	presets: Record<string, ProviderPreset>; // the fixed provider list for this kind
	sends: string; // what leaves the machine, for the Cloud badge ("note text", "prompts")
	extraRows?: (el: HTMLElement, config: C, save: () => Promise<void>) => void;
}

// docs/design/06-settings.md §6.2 — models the provider reported, kept in memory for the
// session. Filled only by user actions (edit URL/provider/key, Refresh), never on open.
interface ModelState {
	loading?: boolean;
	models?: string[];
	total?: number;
	fellBack?: boolean;
	error?: string;
}
const modelStates = new Map<string, ModelState>();

// For tests: the cache is module-level, so it would leak between cases.
export const clearModelCache = (): void => modelStates.clear();

export function renderEditor<C extends AnyProviderConfig>(
	el: HTMLElement,
	plugin: VocabWeavePlugin,
	spec: ProviderKindSpec<C>,
	config: C,
	save: () => Promise<void>,
	render: () => void,
): void {
	const preset = spec.presets[config.type];
	if (!preset) return;

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

	new Setting(el).setName('Provider').addDropdown((dropdown) => {
		for (const p of Object.values(spec.presets)) {
			dropdown.addOption(p.id, presetLabel(p));
		}
		dropdown.setValue(config.type).onChange(async (value) => {
			config.type = value;
			// Local providers start from their default address; cloud ones have a fixed one.
			const next = spec.presets[value];
			config.baseUrl = next?.editableUrl ? next.baseUrl : '';
			config.model = '';
			if ('workflow' in config) config.workflow = '';
			await commitConnection();
		});
	});

	if (preset.editableUrl) {
		new Setting(el)
			.setName('Base URL')
			.setDesc(
				`Where ${preset.label} is running. Default ${preset.baseUrl}`,
			)
			.addText((text) => {
				text.setPlaceholder(preset.baseUrl).setValue(config.baseUrl);
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
	}

	if (preset.key !== 'none') {
		renderApiKeyRows(
			el,
			plugin,
			spec,
			config,
			preset,
			save,
			render,
			commitConnection,
		);
	}
	if (preset.workflow) {
		renderWorkflowRow(
			el,
			config as unknown as WorkflowHolder,
			save,
			render,
		);
	} else {
		renderModelRow(el, plugin, spec, config, preset, save, render);
	}
	spec.extraRows?.(el, config, save);

	el.createDiv({
		cls: `vocabweave-provider-badge ${preset.cloud ? 'is-cloud' : 'is-local'}`,
		text: preset.cloud
			? `Cloud: your ${spec.sends} and API key are sent to ${preset.label}.`
			: 'Local: requests stay on your machine.',
	});
}

function renderApiKeyRows<C extends AnyProviderConfig>(
	el: HTMLElement,
	plugin: VocabWeavePlugin,
	spec: ProviderKindSpec<C>,
	config: C,
	preset: ProviderPreset,
	save: () => Promise<void>,
	render: () => void,
	commitConnection: () => Promise<void>,
): void {
	const need = preset.key === 'optional' ? 'Optional.' : 'Required.';
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
			.setDesc(`Choose or create a secret. ${need}`)
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
		.setDesc(`${need} Stored in this plugin’s data file.`)
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
	plugin: VocabWeavePlugin,
	spec: ProviderKindSpec<C>,
	config: C,
	preset: ProviderPreset,
	save: () => Promise<void>,
	render: () => void,
): void {
	const state = modelStates.get(config.id) ?? {};
	const models = state.models ?? [];
	const setting = new Setting(el).setName('Model');
	const optional = preset.modelOptional
		? ' Optional: the provider has its own default.'
		: '';

	if (state.loading) {
		setting.setDesc('Loading models…');
	} else if (state.error) {
		setting.setDesc(
			`Couldn't load models: ${state.error} Type the model name instead.`,
		);
	} else if (state.fellBack) {
		setting.setDesc(
			`No ${spec.kind} models recognised, so all ${models.length} models from this provider are shown.`,
		);
	} else if (models.length > 0) {
		// Say how many the provider reported, so a filter hiding too much is visible.
		const of =
			state.total !== undefined && state.total > models.length
				? ` (of ${state.total} the provider reports)`
				: '';
		setting.setDesc(
			`${models.length} ${spec.kind} models available${of}.${optional}`,
		);
	} else {
		setting.setDesc(`Refresh to list the available models.${optional}`);
	}

	if (models.length > 0) {
		setting.addDropdown((dropdown) => {
			if (config.model === '')
				dropdown.addOption(
					'',
					preset.modelOptional
						? 'Provider default'
						: 'Select a model…',
				);
			// A saved model the provider no longer lists (or the filter hides) still shows.
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
			.setDisabled(
				state.loading === true ||
					(preset.editableUrl && config.baseUrl === ''),
			)
			.onClick(() => refreshModels(plugin, spec, config, render)),
	);
}

async function refreshModels<C extends AnyProviderConfig>(
	plugin: VocabWeavePlugin,
	spec: ProviderKindSpec<C>,
	config: C,
	render: () => void,
): Promise<void> {
	const preset = spec.presets[config.type];
	if (preset?.workflow) {
		await refreshWorkflows(config as unknown as WorkflowHolder, render);
		return;
	}
	if (!preset || (preset.editableUrl && config.baseUrl === '')) {
		modelStates.delete(config.id);
		render();
		return;
	}
	modelStates.set(config.id, { loading: true });
	render();
	try {
		const { models, total, fellBack } = await listModels(
			spec.kind,
			preset.id,
			endpointUrl(preset, config),
			resolveApiKey(config, (id) =>
				plugin.app.secretStorage.getSecret(id),
			),
		);
		modelStates.set(config.id, { models, total, fellBack });
	} catch (err) {
		const reason =
			err instanceof ProviderError ? err.message : 'unexpected error.';
		modelStates.set(config.id, {
			error: reason.endsWith('.') ? reason : `${reason}.`,
		});
	}
	render();
}
