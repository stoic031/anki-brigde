import type { Plugin } from 'obsidian';
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

export interface AnkiBridgeSettings {
	ankiConnectUrl: string; // '' = unset — resolves to DEFAULT_ANKI_CONNECT_URL at use time, docs/design/06-settings.md §6.1
	profiles: Profile[]; // always >= 1 after loadSettings
	activeProfileId: string; // always an id in `profiles` after loadSettings
	// Tab 1 "Generate with AI" field checkboxes, keyed by fieldConfigKey(deck, model) —
	// saved per Deck+Model pair, not globally. docs/design/07-sidebar.md §7.2.1/§7.4.
	generateWithAiFields: Record<string, string[]>;
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
	return settings;
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
