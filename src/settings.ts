import type { Plugin } from 'obsidian';
import type { ProviderConfig } from './providers/providerManager';
import type { ApprovedCard } from './providers/types';
import {
	IMAGE_PRESETS,
	TEXT_PRESETS,
	type ImageProviderId,
	type ProviderPreset,
	type TextProviderId,
} from './providers/presets';
import {
	DEFAULT_ANKI_CONNECT_URL,
	DEFAULT_MEDIA_PREFIX,
} from './utils/constants';

// docs/design/06-settings.md §6.1 — a named Deck + Model + "Save notes to" bundle used when
// creating notes. '' = unset (folder '' = vault root).
export interface Profile {
	id: string;
	name: string;
	deck: string;
	model: string;
	folder: string;
	// Seeds settings.mainFieldConfig for this Deck+Model pair the first time a note is
	// created from this profile, if that pair has no Main Field yet — docs/design/06-settings.md
	// §6.1, docs/design/07-sidebar.md §7.2.1. '' = unset.
	mainField: string;
	// Feeds AI Generate as context (docs/design/02-providers.md §2.4). '' = unset.
	targetLanguage: string;
}

// docs/design/06-settings.md §6.2 — one saved AI endpoint. Global, not per profile.
export interface ProviderConfigBase {
	id: string;
	name: string;
	baseUrl: string; // only kept for editable (local) presets; cloud providers use the preset's fixed URL
	apiKeySource: 'manual' | 'keychain';
	apiKey: string; // manual source only; user-supplied, sent only to baseUrl; '' is fine for local endpoints
	apiKeySecretId: string; // keychain source only: the *name* of an Obsidian secret, never the key
	model: string;
}

export interface TextProviderConfig extends ProviderConfigBase {
	type: TextProviderId; // a key of TEXT_PRESETS
}

export interface ImageProviderConfig extends ProviderConfigBase {
	type: ImageProviderId; // a key of IMAGE_PRESETS
	negativePrompt: string; // docs/design/06-settings.md §6.2; '' = none
	workflow: string; // ComfyUI only: a saved workflow's path under its workflows/ folder; '' = none
}

// Image tab config for one Deck+Model pair. docs/design/07-sidebar.md §7.2.2.
export interface ImageFieldConfig {
	outputField: string; // '' = not chosen yet
	onExisting: 'append' | 'overwrite';
}

export interface AnkiBridgeSettings {
	ankiConnectUrl: string; // '' = unset — resolves to DEFAULT_ANKI_CONNECT_URL at use time, docs/design/06-settings.md §6.1
	profiles: Profile[]; // always >= 1 after loadSettings
	activeProfileId: string; // always an id in `profiles` after loadSettings
	// Tab 1 "Generate with AI" field checkboxes, keyed by fieldConfigKey(deck, model) —
	// saved per Deck+Model pair, not globally. docs/design/07-sidebar.md §7.2.1/§7.4.
	generateWithAiFields: Record<string, string[]>;
	// Tab 3 Image config, same fieldConfigKey(deck, model) keying. docs/design/07-sidebar.md §7.4.
	imageConfigs: Record<string, ImageFieldConfig>;
	// Main Field dropdown (below Model), keyed by fieldConfigKey(deck, model). '' /
	// absent = not configured. docs/design/07-sidebar.md §7.2.1/§7.4.
	mainFieldConfig: Record<string, string>;
	// Last few cards the user wrote from Generate, keyed by examplesKey(deck, model, lang) —
	// fed back as few-shot examples. docs/design/02-providers.md §2.4.
	generateExamples: Record<string, ApprovedCard[]>;
	textProviders: TextProviderConfig[];
	activeTextProviderId: string; // '' = none configured = no AI calls; else an id in `textProviders`
	imageProviders: ImageProviderConfig[];
	activeImageProviderId: string; // '' = none; else an id in `imageProviders`
	// docs/design/06-settings.md §6.4 — media filename prefix; never empty, see
	// resolveMediaPrefix.
	mediaPrefix: string;
	// docs/design/06-settings.md §6.3 — sync the active note to Anki automatically on save.
	autoSyncOnSave: boolean;
	// docs/design/06-settings.md §6.2 — the user's own language, global (not per profile).
	// Feeds AI Generate as context alongside each profile's targetLanguage. '' = unset.
	nativeLanguage: string;
}

export const DEFAULT_PROFILE_ID = 'default';

const DEFAULT_PROFILE: Profile = {
	id: DEFAULT_PROFILE_ID,
	name: 'Default',
	deck: '',
	model: '',
	folder: '',
	mainField: '',
	targetLanguage: '',
};

export const DEFAULT_SETTINGS: AnkiBridgeSettings = {
	ankiConnectUrl: '',
	profiles: [DEFAULT_PROFILE],
	activeProfileId: DEFAULT_PROFILE_ID,
	generateWithAiFields: {},
	imageConfigs: {},
	mainFieldConfig: {},
	generateExamples: {},
	textProviders: [],
	activeTextProviderId: '',
	imageProviders: [],
	activeImageProviderId: '',
	mediaPrefix: DEFAULT_MEDIA_PREFIX,
	autoSyncOnSave: false,
	nativeLanguage: '',
};

// Pre-profile data.json shape — migrated into a single "Default" profile on load.
interface LegacyFields {
	defaultDeck?: string;
	defaultModel?: string;
	defaultFolder?: string;
	currentDeck?: string;
	currentModel?: string;
	currentFolder?: string;
}

export async function loadSettings(
	plugin: Plugin,
): Promise<AnkiBridgeSettings> {
	const data = ((await plugin.loadData()) ??
		{}) as Partial<AnkiBridgeSettings> & LegacyFields;
	const {
		defaultDeck,
		defaultModel,
		defaultFolder,
		currentDeck,
		currentModel,
		currentFolder,
		...rest
	} = data;
	const settings: AnkiBridgeSettings = {
		...structuredClone(DEFAULT_SETTINGS),
		...rest,
	};
	// The provider lists are fixed now: a config whose provider isn't in them (saved by the
	// earlier custom-endpoint build, never released) can't be used, so it is dropped.
	settings.textProviders = settings.textProviders
		.filter((p) => p.type in TEXT_PRESETS)
		.map(withKeySource);
	settings.imageProviders = settings.imageProviders
		.filter((p) => p.type in IMAGE_PRESETS)
		.map(withKeySource)
		.map((p) => ({ ...p, workflow: p.workflow ?? '' }));
	if (!rest.profiles?.length) {
		settings.profiles = [
			{
				id: DEFAULT_PROFILE_ID,
				name: 'Default',
				deck: currentDeck || defaultDeck || '',
				model: currentModel || defaultModel || '',
				folder: currentFolder || defaultFolder || '',
				mainField: '',
				targetLanguage: '',
			},
		];
	}
	// Saved profiles from before mainField/targetLanguage existed are missing those
	// keys — normalize so callers never see `undefined` for a typed `string` field.
	settings.profiles = settings.profiles.map((p) => ({
		...p,
		mainField: p.mainField ?? '',
		targetLanguage: p.targetLanguage ?? '',
	}));
	if (!settings.profiles.some((p) => p.id === settings.activeProfileId)) {
		settings.activeProfileId =
			settings.profiles[0]?.id ?? DEFAULT_PROFILE_ID;
	}
	if (
		!settings.textProviders.some(
			(p) => p.id === settings.activeTextProviderId,
		)
	) {
		settings.activeTextProviderId = '';
	}
	if (
		!settings.imageProviders.some(
			(p) => p.id === settings.activeImageProviderId,
		)
	) {
		settings.activeImageProviderId = '';
	}
	return settings;
}

function withKeySource<T extends ProviderConfigBase>(p: T): T {
	return {
		...p,
		apiKeySource: p.apiKeySource === 'keychain' ? 'keychain' : 'manual',
		apiKeySecretId: p.apiKeySecretId ?? '',
	};
}

export type SecretLookup = (id: string) => string | null;

// A keychain key is looked up now, not at save time, so a rotated secret applies
// immediately; a missing secret yields '' (local endpoints still work, cloud ones answer
// 401 with a message naming the provider).
export function resolveApiKey(
	p: ProviderConfigBase,
	getSecret: SecretLookup,
): string {
	const key =
		p.apiKeySource === 'keychain'
			? (getSecret(p.apiKeySecretId) ?? '')
			: p.apiKey;
	return key.trim();
}

// Cloud presets have one fixed endpoint; local ones use what the user saved.
export function endpointUrl(
	preset: ProviderPreset,
	p: ProviderConfigBase,
): string {
	return preset.editableUrl ? p.baseUrl.trim() : preset.baseUrl;
}

// A preset that has its own default model needs none; every other needs one.
function isComplete(
	preset: ProviderPreset,
	p: ProviderConfigBase & { workflow?: string },
): boolean {
	if (!endpointUrl(preset, p)) return false;
	// A workflow provider is configured by its workflow, not by a model.
	if (preset.workflow) return !!p.workflow?.trim();
	return !!preset.modelOptional || !!p.model.trim();
}

// What ProviderManager's `text.getConfig` reads: the adapter type + endpoint for the chosen
// provider. An incomplete active config counts as not configured, so nothing is called.
export function getActiveTextConfig(
	settings: AnkiBridgeSettings,
	getSecret: SecretLookup,
): ProviderConfig | null {
	const active = settings.textProviders.find(
		(p) => p.id === settings.activeTextProviderId,
	);
	const preset = active && TEXT_PRESETS[active.type];
	if (!active || !preset || !isComplete(preset, active)) return null;
	return {
		type: preset.adapter,
		baseUrl: preset.apiBase(endpointUrl(preset, active)),
		apiKey: resolveApiKey(active, getSecret),
		model: active.model.trim(),
	};
}

// What ProviderManager's `image.getConfig` reads. No image adapter exists yet (#17).
export function getActiveImageConfig(
	settings: AnkiBridgeSettings,
	getSecret: SecretLookup,
): ProviderConfig | null {
	const active = settings.imageProviders.find(
		(p) => p.id === settings.activeImageProviderId,
	);
	const preset = active && IMAGE_PRESETS[active.type];
	if (!active || !preset || !isComplete(preset, active)) return null;
	return {
		type: preset.adapter,
		baseUrl: preset.apiBase(endpointUrl(preset, active)),
		apiKey: resolveApiKey(active, getSecret),
		model: active.model.trim(),
		negativePrompt: active.negativePrompt.trim(),
		workflow: active.workflow.trim(),
	};
}

export function getActiveProfile(settings: AnkiBridgeSettings): Profile {
	return (
		settings.profiles.find((p) => p.id === settings.activeProfileId) ??
		settings.profiles[0] ??
		DEFAULT_PROFILE
	);
}

export async function saveSettings(
	plugin: Plugin,
	settings: AnkiBridgeSettings,
): Promise<void> {
	await plugin.saveData(settings);
}

export function resolveAnkiConnectUrl(settings: AnkiBridgeSettings): string {
	const trimmed = settings.ankiConnectUrl.trim();
	return trimmed === '' ? DEFAULT_ANKI_CONNECT_URL : trimmed;
}

// docs/contracts.md §5 — the prefix is never empty. Settings Tab already rejects an
// empty/invalid value before save (isValidMediaPrefix); this is defense-in-depth against
// a hand-edited data.json.
export function resolveMediaPrefix(settings: AnkiBridgeSettings): string {
	return settings.mediaPrefix.trim() || DEFAULT_MEDIA_PREFIX;
}

// docs/design/07-sidebar.md §7.4 — per-Deck+Model persistence key for Tab 1/2/3 config.
// JSON-encoded rather than delimiter-joined: Anki deck names routinely contain '::'
// (subdeck separator), so a plain `${deck}::${model}` join risks two different
// (deck, model) pairs colliding on the same string key.
export function fieldConfigKey(deck: string, model: string): string {
	return JSON.stringify([deck, model]);
}

// Few-shot examples are per Deck+Model *and* Learning language, so cards written while
// learning English never steer a Japanese Generate.
export function examplesKey(
	deck: string,
	model: string,
	targetLanguage = '',
): string {
	return JSON.stringify([deck, model, targetLanguage]);
}

export const MAX_EXAMPLES = 3;

// Rolling window: the newest approved card goes last, the oldest drops out, so one
// bad example doesn't stick around.
export function rememberExample(
	settings: AnkiBridgeSettings,
	key: string,
	card: ApprovedCard,
): void {
	const list = [...(settings.generateExamples[key] ?? []), card];
	settings.generateExamples[key] = list.slice(-MAX_EXAMPLES);
}
