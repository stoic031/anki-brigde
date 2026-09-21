import type { Plugin } from 'obsidian';
import type { ProviderConfig } from './providers/providerManager';
import { DEFAULT_ANKI_CONNECT_URL } from './utils/constants';

// docs/design/06-settings.md §6.1 — a named Deck + Model + "Save notes to" bundle used when
// creating notes. '' = unset (folder '' = vault root).
export interface Profile {
	id: string;
	name: string;
	deck: string;
	model: string;
	folder: string;
}

// docs/design/06-settings.md §6.2 — one saved AI endpoint. Global, not per profile.
export interface ProviderConfigBase {
	id: string;
	name: string;
	baseUrl: string;
	apiKeySource: 'manual' | 'keychain';
	apiKey: string; // manual source only; user-supplied, sent only to baseUrl; '' is fine for local endpoints
	apiKeySecretId: string; // keychain source only: the *name* of an Obsidian secret, never the key
	model: string;
}

export interface TextProviderConfig extends ProviderConfigBase {
	type: 'openai-compatible' | 'anthropic';
}

export interface ImageProviderConfig extends ProviderConfigBase {
	type: 'openai-compatible' | 'automatic1111';
	negativePrompt: string; // docs/design/06-settings.md §6.2; '' = none
}

export interface AnkiBridgeSettings {
	ankiConnectUrl: string; // '' = unset — resolves to DEFAULT_ANKI_CONNECT_URL at use time, docs/design/06-settings.md §6.1
	profiles: Profile[]; // always >= 1 after loadSettings
	activeProfileId: string; // always an id in `profiles` after loadSettings
	// Tab 1 "Generate with AI" field checkboxes, keyed by fieldConfigKey(deck, model) —
	// saved per Deck+Model pair, not globally. docs/design/07-sidebar.md §7.2.1/§7.4.
	generateWithAiFields: Record<string, string[]>;
	textProviders: TextProviderConfig[];
	activeTextProviderId: string; // '' = none configured = no AI calls; else an id in `textProviders`
	imageProviders: ImageProviderConfig[];
	activeImageProviderId: string; // '' = none; else an id in `imageProviders`
}

export const DEFAULT_PROFILE_ID = 'default';

const DEFAULT_PROFILE: Profile = {
	id: DEFAULT_PROFILE_ID,
	name: 'Default',
	deck: '',
	model: '',
	folder: '',
};

export const DEFAULT_SETTINGS: AnkiBridgeSettings = {
	ankiConnectUrl: '',
	profiles: [DEFAULT_PROFILE],
	activeProfileId: DEFAULT_PROFILE_ID,
	generateWithAiFields: {},
	textProviders: [],
	activeTextProviderId: '',
	imageProviders: [],
	activeImageProviderId: '',
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
	// Configs saved before the keychain option existed have no source: they were manual.
	settings.textProviders = settings.textProviders.map(withKeySource);
	settings.imageProviders = settings.imageProviders.map(withKeySource);
	if (!rest.profiles?.length) {
		settings.profiles = [
			{
				id: DEFAULT_PROFILE_ID,
				name: 'Default',
				deck: currentDeck || defaultDeck || '',
				model: currentModel || defaultModel || '',
				folder: currentFolder || defaultFolder || '',
			},
		];
	}
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

// The adapter config for one saved provider. A keychain key is looked up now, not at save
// time, so a rotated secret applies immediately; a missing secret yields '' (local
// endpoints still work, cloud ones answer 401 with a message naming the provider).
export function toProviderConfig(
	p: ProviderConfigBase & { type: string },
	getSecret: SecretLookup,
): ProviderConfig {
	const apiKey =
		p.apiKeySource === 'keychain'
			? (getSecret(p.apiKeySecretId) ?? '')
			: p.apiKey;
	return {
		type: p.type,
		baseUrl: p.baseUrl.trim(),
		apiKey: apiKey.trim(),
		model: p.model.trim(),
	};
}

// What ProviderManager's `text.getConfig` reads. An active config missing its Base URL or
// Model is treated as not configured, so nothing is called until it is complete.
export function getActiveTextConfig(
	settings: AnkiBridgeSettings,
	getSecret: SecretLookup,
): ProviderConfig | null {
	const active = settings.textProviders.find(
		(p) => p.id === settings.activeTextProviderId,
	);
	if (!active || !active.baseUrl.trim() || !active.model.trim()) return null;
	return toProviderConfig(active, getSecret);
}

// What ProviderManager's `image.getConfig` reads. Automatic1111 picks its own checkpoint, so
// its Model is optional; every other type needs Base URL and Model.
export function getActiveImageConfig(
	settings: AnkiBridgeSettings,
	getSecret: SecretLookup,
): ProviderConfig | null {
	const active = settings.imageProviders.find(
		(p) => p.id === settings.activeImageProviderId,
	);
	if (!active || !active.baseUrl.trim()) return null;
	if (active.type !== 'automatic1111' && !active.model.trim()) return null;
	return {
		...toProviderConfig(active, getSecret),
		negativePrompt: active.negativePrompt.trim(),
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

// docs/design/07-sidebar.md §7.4 — per-Deck+Model persistence key for Tab 1/2/3 config.
// JSON-encoded rather than delimiter-joined: Anki deck names routinely contain '::'
// (subdeck separator), so a plain `${deck}::${model}` join risks two different
// (deck, model) pairs colliding on the same string key.
export function fieldConfigKey(deck: string, model: string): string {
	return JSON.stringify([deck, model]);
}
