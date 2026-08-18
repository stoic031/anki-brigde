import type { App, MarkdownPostProcessorContext, Plugin } from 'obsidian';
import { Notice, TFile } from 'obsidian';
import { readAnkiFrontmatter } from '../sync/parser';
import { syncNote } from '../sync/syncEngine';
import { AnkiConnectClient } from '../sync/ankiConnect';
import { DEFAULT_ANKI_CONNECT_URL } from '../utils/constants';
import { SyncError } from '../types';

// docs/design/03-note.md §3.1
export const CONTROLS_BLOCK_LANGUAGE = 'anki-controls';
export const CONTROLS_CONTAINER_CLASS = 'anki-bridge-controls';
export const CONTROLS_BUTTON_CLASS = 'anki-bridge-controls__button';

export type ControlAction =
	'sync' | 'generate-ai' | 'add-audio' | 'add-image' | 'delete';

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
const DELETE_BUTTON: ControlButtonSpec = {
	action: 'delete',
	label: '🗑️ Delete',
};

export function registerControlsBlock(plugin: Plugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		CONTROLS_BLOCK_LANGUAGE,
		(source, el, ctx) => renderControlsBlock(plugin.app, source, el, ctx),
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
		file instanceof TFile &&
		readAnkiFrontmatter(app, file)?.anki_note_id !== undefined;
	const buttons = hasNoteId
		? [...ALWAYS_VISIBLE_BUTTONS, DELETE_BUTTON]
		: ALWAYS_VISIBLE_BUTTONS;

	for (const { action, label } of buttons) {
		const button = container.createEl('button', {
			cls: [CONTROLS_BUTTON_CLASS, `${CONTROLS_BUTTON_CLASS}--${action}`],
			text: label,
			attr: { type: 'button', 'data-action': action },
		});

		if (action === 'sync' && file instanceof TFile) {
			button.addEventListener(
				'click',
				() => void handleSync(app, file, button, label),
			);
		}
	}
}

// docs/design/05-ui.md §5.1-5.2
async function handleSync(
	app: App,
	file: TFile,
	button: HTMLButtonElement,
	label: string,
): Promise<void> {
	if (button.disabled) return;

	button.disabled = true;
	button.setText('⏳ Processing...');

	try {
		const client = new AnkiConnectClient(DEFAULT_ANKI_CONNECT_URL);
		await syncNote(app, file, client);
		button.setText('✅ Done!');
		new Notice('✅ Note synced to Anki!', 3000);
		window.setTimeout(() => {
			button.setText(label);
			button.disabled = false;
		}, 2000);
	} catch (err) {
		// SyncError already carries a case-specific message (offline/duplicate/
		// model-not-found/parse-error — docs/design/01-sync.md §1.6); show it instead of
		// the generic 05-ui.md copy so "model not found" doesn't read as "Anki is down".
		const message =
			err instanceof SyncError
				? `❌ ${err.message}`
				: '❌ Failed to sync. Please check Anki connection.';
		button.setText('❌ Error');
		new Notice(message, 5000);
		window.setTimeout(() => {
			button.setText(label);
			button.disabled = false;
		}, 3000);
	}
}
