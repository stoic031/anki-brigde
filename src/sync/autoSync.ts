import { TFile } from 'obsidian';
import type AnkiBridgePlugin from '../main';
import { resolveAnkiConnectUrl } from '../settings';
import { SyncError } from '../types';
import { toastError, toastSuccess } from '../ui/toast';
import { AnkiConnectClient } from './ankiConnect';
import { readAnkiFrontmatter } from './parser';
import { syncNote } from './syncEngine';

// docs/design/06-settings.md §6.3 — sync the active note on save, when enabled. Debounced
// per file (AGENTS.md: "debounce re-parsing on file-save") so an actively-typing session
// doesn't fire a real AnkiConnect call on every autosave tick.
const DEBOUNCE_MS = 2000;

export function registerAutoSync(plugin: AnkiBridgePlugin): void {
	const timers = new Map<string, ReturnType<typeof window.setTimeout>>();
	// Guards against syncNote's own frontmatter write (writeAnkiFrontmatter) re-firing
	// 'modify' and triggering a second, overlapping auto-sync of the same file.
	const inFlight = new Set<string>();

	plugin.registerEvent(
		plugin.app.vault.on('modify', (file) => {
			if (!plugin.settings.autoSyncOnSave) return;
			if (!(file instanceof TFile) || file.extension !== 'md') return;
			// Only touch the active note (AGENTS.md non-negotiable #5) — 'modify' fires for
			// any vault write, not just the one the user is looking at.
			if (file !== plugin.app.workspace.getActiveFile()) return;

			const existing = timers.get(file.path);
			if (existing !== undefined) window.clearTimeout(existing);
			timers.set(
				file.path,
				window.setTimeout(() => {
					timers.delete(file.path);
					void trigger(plugin, file, inFlight);
				}, DEBOUNCE_MS),
			);
		}),
	);
}

async function trigger(
	plugin: AnkiBridgePlugin,
	file: TFile,
	inFlight: Set<string>,
): Promise<void> {
	// Re-check: the user may have switched notes during the debounce window.
	if (file !== plugin.app.workspace.getActiveFile()) return;
	if (inFlight.has(file.path)) return;

	// Not (yet) configured for Anki — skip silently. Without this, every markdown save in
	// the vault would attempt an AnkiConnect call the moment the toggle is on.
	const frontmatter = readAnkiFrontmatter(plugin.app, file);
	if (!frontmatter?.anki_deck || !frontmatter.anki_model) return;

	// ponytail: no coordination with the manual Sync button's own busy flag
	// (noteActions.ts) — a click landing on the same file at the exact moment this
	// fires is an accepted, narrow double-call risk, not worth the cross-module
	// coupling to close.
	inFlight.add(file.path);
	try {
		const client = new AnkiConnectClient(
			resolveAnkiConnectUrl(plugin.settings),
		);
		await syncNote(plugin.app, file, client);
		toastSuccess('✅ Note synced to Anki!');
	} catch (err) {
		toastError(
			err instanceof SyncError
				? `❌ ${err.message}`
				: '❌ Failed to sync. Please check Anki connection.',
		);
	} finally {
		inFlight.delete(file.path);
	}
}
