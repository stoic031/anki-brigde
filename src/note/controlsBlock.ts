import type { App, MarkdownPostProcessorContext, Plugin } from 'obsidian';
import { TFile } from 'obsidian';
import { readAnkiFrontmatter } from '../sync/parser';

// docs/design/03-note.md §3.1
export const CONTROLS_BLOCK_LANGUAGE = 'anki-controls';
export const CONTROLS_CONTAINER_CLASS = 'anki-bridge-controls';
export const CONTROLS_BUTTON_CLASS = 'anki-bridge-controls__button';

export type ControlAction = 'sync' | 'generate-ai' | 'add-audio' | 'add-image' | 'delete';

interface ControlButtonSpec {
	action: ControlAction;
	label: string;
}

// docs/design/03-note.md §3.2 — always shown; each button's own pre-check gates the action, not visibility
const ALWAYS_VISIBLE_BUTTONS: ControlButtonSpec[] = [
	{ action: 'sync', label: '🔄 Sync' },
	{ action: 'generate-ai', label: '🤖 Generate with AI' },
	{ action: 'add-audio', label: '🔊 Add audio' },
	{ action: 'add-image', label: '🖼️ Add image' },
];

// docs/design/03-note.md §3.2 — only rendered when frontmatter has anki_note_id
const DELETE_BUTTON: ControlButtonSpec = { action: 'delete', label: '🗑️ Delete' };

export function registerControlsBlock(plugin: Plugin): void {
	plugin.registerMarkdownCodeBlockProcessor(CONTROLS_BLOCK_LANGUAGE, (source, el, ctx) =>
		renderControlsBlock(plugin.app, source, el, ctx),
	);
}

export function renderControlsBlock(
	app: App,
	_source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): void {
	const container = el.createDiv({ cls: CONTROLS_CONTAINER_CLASS });

	// ctx.frontmatter is unreliable in Live Preview (only populated on the Reading view
	// render pass) — read via metadataCache instead so Delete shows in both modes.
	const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
	const hasNoteId =
		file instanceof TFile && readAnkiFrontmatter(app, file)?.anki_note_id !== undefined;
	const buttons = hasNoteId ? [...ALWAYS_VISIBLE_BUTTONS, DELETE_BUTTON] : ALWAYS_VISIBLE_BUTTONS;

	for (const { action, label } of buttons) {
		container.createEl('button', {
			cls: [CONTROLS_BUTTON_CLASS, `${CONTROLS_BUTTON_CLASS}--${action}`],
			text: label,
			attr: { type: 'button', 'data-action': action },
		});
	}
}
