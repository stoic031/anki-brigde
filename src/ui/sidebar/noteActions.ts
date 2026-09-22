import type { TFile } from 'obsidian';
import type AnkiBridgePlugin from '../../main';
import { rebuildContent } from '../../note/contentTemplate';
import { resolveAnkiConnectUrl } from '../../settings';
import { AnkiConnectClient } from '../../sync/ankiConnect';
import { deleteNote, syncNote } from '../../sync/syncEngine';
import { ConfirmDeleteModal } from '../modals/confirmDelete';
import { ConfirmRebuildFieldsModal } from '../modals/confirmRebuildFields';
import { toastSuccess } from '../toast';
import { createActionButton, runAction } from './actionButton';

export interface ActionState {
	note: TFile | null; // active markdown note, if any
	model: string; // its anki_model ('' = unset)
	synced: boolean; // it has an anki_note_id
}

export interface NoteActions {
	update(state: ActionState): void;
}

// docs/design/07-sidebar.md §7.2.1 — Sync | Rebuild | Delete on one row (Note tab).
// Visibility/enabled state comes from update(), which the view calls whenever the active
// note or its frontmatter changes — so Delete appears right after the first sync.
export function renderNoteActions(
	parent: HTMLElement,
	plugin: AnkiBridgePlugin,
): NoteActions {
	const row = parent.createDiv({ cls: 'anki-bridge-sidebar__actions' });
	const sync = createActionButton(row, {
		icon: 'refresh-cw',
		label: 'Sync',
		variant: 'primary',
	});
	const rebuild = createActionButton(row, { icon: 'hammer', label: 'Rebuild' });
	const del = createActionButton(row, {
		icon: 'trash-2',
		label: 'Delete',
		variant: 'danger',
	});

	let state: ActionState = { note: null, model: '', synced: false };
	const client = () =>
		new AnkiConnectClient(resolveAnkiConnectUrl(plugin.settings));

	const apply = () => {
		if (!sync.busy) sync.el.disabled = !state.note;
		if (!rebuild.busy) rebuild.el.disabled = !state.note || !state.model;
		// docs/design/03-note.md §3.2 — Delete only exists once the note has an anki_note_id.
		if (!del.busy) {
			del.el.disabled = false;
			del.el.hidden = !state.synced;
		}
	};
	apply();

	sync.el.addEventListener('click', () => {
		const { note } = state;
		if (!note || sync.el.disabled) return;
		void runAction(sync, {
			work: async () => {
				await syncNote(plugin.app, note, client());
				toastSuccess('✅ Note synced to Anki!');
			},
			failure: '❌ Failed to sync. Please check Anki connection.',
			onRestore: apply,
		});
	});

	rebuild.el.addEventListener('click', () => {
		const { note, model } = state;
		if (!note || !model || rebuild.el.disabled) return;
		// Destructive: replaces everything below the frontmatter. Always confirm.
		new ConfirmRebuildFieldsModal(
			plugin.app,
			() =>
				void runAction(rebuild, {
					work: async () => {
						const fields = await client().modelFieldNames(model);
						await plugin.app.vault.process(note, (content) =>
							rebuildContent(content, fields),
						);
						toastSuccess('✅ Note fields rebuilt.');
					},
					failure: '❌ Failed to rebuild fields. Please check Anki connection.',
					onRestore: apply,
				}),
		).open();
	});

	del.el.addEventListener('click', () => {
		const { note } = state;
		if (!note || del.el.disabled) return;
		new ConfirmDeleteModal(
			plugin.app,
			() =>
				void runAction(del, {
					work: async () => {
						await deleteNote(plugin.app, note, client());
						toastSuccess('✅ Note deleted from Anki!');
					},
					failure: '❌ Failed to delete. Please check Anki connection.',
					onRestore: apply,
					hideOnSuccess: true,
				}),
		).open();
	});

	return {
		update(next) {
			state = next;
			apply();
		},
	};
}
