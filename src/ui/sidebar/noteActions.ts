import { Notice, type TFile } from 'obsidian';
import type AnkiBridgePlugin from '../../main';
import { rebuildContent } from '../../note/contentTemplate';
import { syncNoteName } from '../../note/noteName';
import { fieldConfigKey, resolveAnkiConnectUrl } from '../../settings';
import { AnkiConnectClient } from '../../sync/ankiConnect';
import { deleteNote, pullNote, syncNote } from '../../sync/syncEngine';
import { SyncError } from '../../types';
import { ConfirmModal, DELETE_COPY, REBUILD_COPY } from '../modals/confirm';
import { SyncConflictModal, type ConflictChoice } from '../modals/syncConflict';
import { toastError, toastSuccess } from '../toast';
import { createActionButton, runAction } from './actionButton';

export interface ActionState {
	note: TFile | null; // active markdown note, if any
	deck: string; // its anki_deck ('' = unset)
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
	const rebuild = createActionButton(row, {
		icon: 'hammer',
		label: 'Rebuild',
	});
	const del = createActionButton(row, {
		icon: 'trash-2',
		label: 'Delete',
		variant: 'danger',
	});

	let state: ActionState = { note: null, deck: '', model: '', synced: false };
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
		const { note, deck, model } = state;
		if (!note || sync.el.disabled) return;
		void runAction(sync, {
			work: async () => {
				let done = '✅ Note synced to Anki!';
				try {
					await syncNote(plugin.app, note, client());
				} catch (err) {
					if (
						!(err instanceof SyncError) ||
						err.reason !== 'anki-edited'
					)
						throw err;
					// docs/design/01-sync.md §1.1 — Anki was edited since the last sync: ask.
					const choice = await new Promise<ConflictChoice>(
						(resolve) =>
							new SyncConflictModal(plugin.app, resolve).open(),
					);
					if (choice === null) throw err;
					if (choice === 'anki') {
						const warning = await pullNote(
							plugin.app,
							note,
							client(),
						);
						if (warning) toastError(`⚠️ ${warning}`);
						done = '✅ Note updated from Anki!';
					} else {
						await syncNote(plugin.app, note, client(), {
							force: true,
						});
					}
				}
				// docs/design/03-note.md §3.2 — the note name follows its Main Field.
				await syncNoteName(
					plugin.app,
					note,
					plugin.settings.mainFieldConfig[
						fieldConfigKey(deck, model)
					],
				).catch((err: unknown) =>
					toastError(
						`❌ Synced, but couldn't rename the note: ${String(err)}`,
					),
				);
				toastSuccess(done);
			},
			failure: '❌ Failed to sync. Please check Anki connection.',
			onRestore: apply,
		});
	});

	rebuild.el.addEventListener('click', () => {
		const { note, deck, model } = state;
		if (!note || !model || rebuild.el.disabled) return;
		// docs/design/03-note.md §3.2 — Rebuild requires Main Field, same shape as the
		// AI buttons' pre-check: the note is already open, so its Main Field dropdown
		// is already visible in the sidebar for the user to set.
		const mainField =
			plugin.settings.mainFieldConfig[fieldConfigKey(deck, model)];
		if (!mainField) {
			new Notice(
				'Please choose a main field for this deck/model in the sidebar first.',
			);
			return;
		}
		// Destructive: replaces everything below the frontmatter. Always confirm.
		new ConfirmModal(
			plugin.app,
			REBUILD_COPY,
			() =>
				void runAction(rebuild, {
					work: async () => {
						const fields = await client().modelFieldNames(model);
						await plugin.app.vault.process(note, (content) =>
							rebuildContent(content, fields, {
								field: mainField,
								content: note.basename,
							}),
						);
						toastSuccess('✅ Note fields rebuilt.');
					},
					failure:
						'❌ Failed to rebuild fields. Please check Anki connection.',
					onRestore: apply,
				}),
		).open();
	});

	del.el.addEventListener('click', () => {
		const { note } = state;
		if (!note || del.el.disabled) return;
		new ConfirmModal(
			plugin.app,
			DELETE_COPY,
			() =>
				void runAction(del, {
					work: async () => {
						await deleteNote(plugin.app, note, client());
						toastSuccess('✅ Note deleted from Anki!');
					},
					failure:
						'❌ Failed to delete. Please check Anki connection.',
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
