import { App, MarkdownView, Notice } from 'obsidian';
import { getUniqueNotePath, noteFilename } from './noteName';
import { generateContentSkeleton } from './contentTemplate';
import {
	fieldConfigKey,
	getActiveProfile,
	resolveAnkiConnectUrl,
	type VocabWeaveSettings,
} from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { writeAnkiFrontmatter } from '../sync/parser';
import { toastError } from '../ui/toast';
import { revealSidebarView } from '../ui/sidebarView';
import type VocabWeavePlugin from '../main';

// docs/design/03-note.md §3.7 — selection source is the active markdown note only.
export function getSelectedText(app: App): string | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return null;
	return view.editor.getSelection();
}

// docs/design/03-note.md §3.7 step 3.
export function getQuickCaptureFilename(selectedText: string): string {
	return `${noteFilename(selectedText)}.md`;
}

export interface QuickCaptureTarget {
	deck: string;
	model: string;
	folder: string;
	mainField: string; // the profile's Main Field default, '' = unset — see resolveMainField
}

// docs/design/07-sidebar.md §7.3 step [2], reused for the hotkey flow per
// docs/design/03-note.md §3.7 step 4. Target comes from the active profile; returns
// null when it has no Deck/Model — caller shows a Notice and opens Settings instead
// of creating a note.
export function resolveQuickCaptureTarget(
	settings: VocabWeaveSettings,
): QuickCaptureTarget | null {
	const { deck, model, folder, mainField } = getActiveProfile(settings);
	return deck && model ? { deck, model, folder, mainField } : null;
}

// docs/design/06-settings.md §6.1 — seeds mainFieldConfig for this Deck+Model pair
// from the profile's Main Field default, the first time only (never overwrites a
// pair that's already configured, e.g. from the sidebar). Shared by runCreateNote and
// runQuickCapture — both create notes from a resolved QuickCaptureTarget.
export async function resolveMainField(
	plugin: VocabWeavePlugin,
	target: QuickCaptureTarget,
): Promise<string> {
	const key = fieldConfigKey(target.deck, target.model);
	const existing = plugin.settings.mainFieldConfig[key];
	if (existing) return existing;
	if (!target.mainField) return '';
	plugin.settings.mainFieldConfig[key] = target.mainField;
	await plugin.saveSettings();
	return target.mainField;
}

interface AppWithSettingTab {
	setting: { open: () => void; openTabById: (id: string) => void };
}

// Undocumented but community-standard way to open Settings to a specific plugin tab;
// `App` has no typed `setting` property in obsidian.d.ts.
export function openPluginSettings(app: App, pluginId: string): void {
	const withSettings = app as unknown as App & AppWithSettingTab;
	withSettings.setting.open();
	withSettings.setting.openTabById(pluginId);
}

// docs/design/03-note.md §3.7 steps 1-8.
export async function runQuickCapture(plugin: VocabWeavePlugin): Promise<void> {
	const selectedText = getSelectedText(plugin.app);
	if (selectedText === null) {
		toastError('❌ No active markdown note to capture from.');
		return;
	}

	const target = resolveQuickCaptureTarget(plugin.settings);
	if (!target) {
		new Notice('Please set up a profile in settings first');
		openPluginSettings(plugin.app, plugin.manifest.id);
		return;
	}

	try {
		const client = new AnkiConnectClient(
			resolveAnkiConnectUrl(plugin.settings),
		);
		const fields = await client.modelFieldNames(target.model);

		const filename = getQuickCaptureFilename(selectedText);
		const path = getUniqueNotePath(plugin.app, target.folder, filename);
		// Main Field isn't required here — see the same note in createNote.ts.
		const mainField = await resolveMainField(plugin, target);
		const content = generateContentSkeleton(
			fields,
			mainField ? { field: mainField, content: selectedText } : undefined,
		);

		const file = await plugin.app.vault.create(path, content);
		await writeAnkiFrontmatter(plugin.app, file, {
			anki_deck: target.deck,
			anki_model: target.model,
		});
		await plugin.app.workspace.getLeaf(false).openFile(file);
		await revealSidebarView(plugin.app);
	} catch {
		toastError('❌ Failed to create note. Please check Anki connection.');
	}
}
