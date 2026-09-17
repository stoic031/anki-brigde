import type { Plugin } from 'obsidian';
import { DEFAULT_ANKI_CONNECT_URL } from './utils/constants';

export interface AnkiBridgeSettings {
	ankiConnectUrl: string; // '' = unset — resolves to DEFAULT_ANKI_CONNECT_URL at use time, docs/design/06-settings.md §6.1
	defaultDeck: string; // '' = unset — docs/design/06-settings.md §6.1
	defaultModel: string; // '' = unset — docs/design/06-settings.md §6.1
	currentDeck: string; // '' = not yet set — Tab 1's persisted "current" value, docs/design/07-sidebar.md §7.4
	currentModel: string; // '' = not yet set — docs/design/07-sidebar.md §7.4
	currentFolder: string; // '' = vault root — docs/design/07-sidebar.md §7.4
	// Tab 1 "Generate with AI" field checkboxes, keyed by fieldConfigKey(deck, model) —
	// saved per Deck+Model pair, not globally. docs/design/07-sidebar.md §7.2.1/§7.4.
	generateWithAiFields: Record<string, string[]>;
}

export const DEFAULT_SETTINGS: AnkiBridgeSettings = {
	ankiConnectUrl: '',
	defaultDeck: '',
	defaultModel: '',
	currentDeck: '',
	currentModel: '',
	currentFolder: '',
	generateWithAiFields: {},
};

export async function loadSettings(
	plugin: Plugin,
): Promise<AnkiBridgeSettings> {
	const data =
		(await plugin.loadData()) as Partial<AnkiBridgeSettings> | null;
	return { ...DEFAULT_SETTINGS, ...data };
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
