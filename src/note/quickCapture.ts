import { App, MarkdownView } from 'obsidian';
import { sanitizeForFilename } from './mediaNaming';

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
