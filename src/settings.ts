import type { Plugin } from 'obsidian';
import { DEFAULT_ANKI_CONNECT_URL } from './utils/constants';

export interface AnkiBridgeSettings {
	ankiConnectUrl: string; // '' = unset — resolves to DEFAULT_ANKI_CONNECT_URL at use time, docs/design/06-settings.md §6.1
	defaultDeck: string; // '' = unset — docs/design/06-settings.md §6.1
	defaultModel: string; // '' = unset — docs/design/06-settings.md §6.1
}

export const DEFAULT_SETTINGS: AnkiBridgeSettings = {
	ankiConnectUrl: '',
	defaultDeck: '',
	defaultModel: '',
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
