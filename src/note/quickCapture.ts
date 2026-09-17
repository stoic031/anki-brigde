import { App, MarkdownView, Notice } from 'obsidian';
import { sanitizeForFilename } from './mediaNaming';
import { generateContentSkeleton } from './contentTemplate';
import { resolveAnkiConnectUrl, type AnkiBridgeSettings } from '../settings';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { writeAnkiFrontmatter } from '../sync/parser';
import { toastError } from '../ui/toast';
import { revealSidebarView } from '../ui/sidebarView';
import type AnkiBridgePlugin from '../main';

// docs/design/03-note.md §3.7 — selection source is the active markdown note only.
export function getSelectedText(app: App): string | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return null;
	return view.editor.getSelection();
}

// docs/design/03-note.md §3.7 step 3.
export function getQuickCaptureFilename(selectedText: string): string {
	return `${sanitizeForFilename(selectedText)}.md`;
}

export interface QuickCaptureTarget {
	deck: string;
	model: string;
	folder: string;
	seededFromDefaults: boolean;
}

// docs/design/07-sidebar.md §7.3 step [2], reused for the hotkey flow per
// docs/design/03-note.md §3.7 step 4. Returns null when neither Tab 1's current
// value nor the Settings Tab defaults are configured — caller shows a Notice and
// opens Settings instead of creating a note.
export function resolveQuickCaptureTarget(
	settings: AnkiBridgeSettings,
): QuickCaptureTarget | null {
	if (settings.currentDeck && settings.currentModel) {
		return {
			deck: settings.currentDeck,
			model: settings.currentModel,
			folder: settings.currentFolder,
			seededFromDefaults: false,
		};
	}
	if (settings.defaultDeck && settings.defaultModel) {
		return {
			deck: settings.defaultDeck,
			model: settings.defaultModel,
			folder: settings.defaultFolder,
			seededFromDefaults: true,
		};
	}
	return null;
}

// docs/design/03-note.md §3.7 step 5 — Obsidian's own numeric-suffix convention
// for name collisions ("word 1.md"); never overwrite, never error.
export function getUniqueNotePath(
	app: App,
	folder: string,
	filename: string,
): string {
	const base = filename.replace(/\.md$/, '');
	const join = (name: string) => (folder ? `${folder}/${name}` : name);

	let candidate = join(filename);
	for (let n = 1; app.vault.getAbstractFileByPath(candidate); n++) {
		candidate = join(`${base} ${n}.md`);
	}
	return candidate;
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
export async function runQuickCapture(plugin: AnkiBridgePlugin): Promise<void> {
	const selectedText = getSelectedText(plugin.app);
	if (selectedText === null) {
		toastError('❌ No active markdown note to capture from.');
		return;
	}

	const target = resolveQuickCaptureTarget(plugin.settings);
	if (!target) {
		new Notice(
			'Please configure Deck, Model, and Save location in Settings first',
		);
		openPluginSettings(plugin.app, plugin.manifest.id);
		return;
	}

	if (target.seededFromDefaults) {
		plugin.settings.currentDeck = target.deck;
		plugin.settings.currentModel = target.model;
		plugin.settings.currentFolder = target.folder;
		await plugin.saveSettings();
	}

	try {
		const client = new AnkiConnectClient(
			resolveAnkiConnectUrl(plugin.settings),
		);
		const fields = await client.modelFieldNames(target.model);

		const filename = getQuickCaptureFilename(selectedText);
		const path = getUniqueNotePath(plugin.app, target.folder, filename);
		const content = generateContentSkeleton(fields, selectedText);

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
