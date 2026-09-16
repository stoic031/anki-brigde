import { App, MarkdownView } from 'obsidian';
import { sanitizeForFilename } from './mediaNaming';
import type { AnkiBridgeSettings } from '../settings';

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
			folder: settings.currentFolder,
			seededFromDefaults: true,
		};
	}
	return null;
}
