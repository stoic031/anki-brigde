import type { App, TFile } from 'obsidian';
import type { AnkiConnectClient } from './ankiConnect';
import {
	readAnkiFrontmatter,
	parseSections,
	replaceSection,
	writeAnkiFrontmatter,
} from './parser';
import { mapContentToFields } from './fieldMapper';
import { ankiHtmlToMarkdown } from './ankiHtml';
import { AnkiConnectError, SyncError, type AnkiFrontmatter } from '../types';

// `force` skips the Anki-edited check (docs/design/01-sync.md §1.1) — the user chose to
// keep the Obsidian version.
export async function syncNote(
	app: App,
	file: TFile,
	client: AnkiConnectClient,
	opts: { force?: boolean } = {},
): Promise<void> {
	const frontmatter = readAnkiFrontmatter(app, file);
	if (!frontmatter) {
		throw new SyncError(
			'parse-error',
			'Cannot parse note content. Please check format.',
		);
	}

	try {
		const content = await app.vault.cachedRead(file);
		const sections = parseSections(content);
		const modelFields = await client.modelFieldNames(
			frontmatter.anki_model,
		);
		const { fields } = mapContentToFields(
			sections,
			modelFields,
			frontmatter.anki_model,
		);

		if (frontmatter.anki_note_id === undefined) {
			await createNote(app, file, client, frontmatter, fields);
			return;
		}

		if (!opts.force) await checkAnkiEdits(client, frontmatter, fields);

		try {
			await client.updateNoteFields(frontmatter.anki_note_id, fields);
		} catch (err) {
			if (!isNoteNotFound(err)) throw err;
			// AnkiConnect reports the note is gone — clear the stale ID and recreate it
			// so sync stays idempotent instead of surfacing a hard error (#56).
			await writeAnkiFrontmatter(app, file, {
				anki_note_id: undefined,
				anki_mod: undefined,
			});
			await createNote(app, file, client, frontmatter, fields);
			return;
		}
		const mod = await verifyUpdate(
			client,
			frontmatter.anki_note_id,
			fields,
		);
		await writeAnkiFrontmatter(app, file, { anki_mod: mod });
	} catch (err) {
		throw toSyncError(err);
	}
}

const sameFields = (
	a: Record<string, string>,
	b: Record<string, string>,
): boolean =>
	Object.entries(a).every(
		([name, value]) => (b[name] ?? '').trim() === value.trim(),
	);

// Anki was edited since the plugin last wrote it and now holds something other than what
// we're about to send. No baseline (synced by an older version) counts as edited when the
// fields differ, so the first sync after upgrading can't silently drop Anki edits.
async function checkAnkiEdits(
	client: AnkiConnectClient,
	frontmatter: AnkiFrontmatter,
	fields: Record<string, string>,
): Promise<void> {
	if (frontmatter.anki_note_id === undefined) return;
	const info = await client.noteInfo(frontmatter.anki_note_id);
	// notesInfo returns an empty entry for a deleted note — the update path recreates it.
	if (Object.keys(info.fields).length === 0) return;
	const edited =
		frontmatter.anki_mod === undefined || info.mod > frontmatter.anki_mod;
	if (edited && !sameFields(fields, info.fields)) {
		throw new SyncError(
			'anki-edited',
			'This note was edited in Anki since the last sync.',
		);
	}
}

// docs/design/01-sync.md §1.3 — replace each mapped section's body with its Anki field.
// Returns a warning naming Anki fields with no section in the note, if any.
export async function pullNote(
	app: App,
	file: TFile,
	client: AnkiConnectClient,
): Promise<string | undefined> {
	const frontmatter = readAnkiFrontmatter(app, file);
	if (frontmatter?.anki_note_id === undefined) {
		throw new SyncError(
			'parse-error',
			'Cannot parse note content. Please check format.',
		);
	}

	try {
		const info = await client.noteInfo(frontmatter.anki_note_id);
		if (Object.keys(info.fields).length === 0) {
			throw new SyncError(
				'note-not-found',
				'Note not found in Anki. Sync it again to recreate it.',
			);
		}
		const modelFields = await client.modelFieldNames(
			frontmatter.anki_model,
		);
		const missing: string[] = [];
		await app.vault.process(file, (content) => {
			const sections = parseSections(content);
			const { sources } = mapContentToFields(
				sections,
				modelFields,
				frontmatter.anki_model,
			);
			for (const field of modelFields) {
				const key = sources[field];
				const value = ankiHtmlToMarkdown(info.fields[field] ?? '');
				if (key === undefined) {
					if (value !== '') missing.push(field);
					continue;
				}
				// A bullet-list section stays a list: one "- " item per line.
				const body = Array.isArray(sections.get(key))
					? value
							.split('\n')
							.filter((line) => line.trim() !== '')
							.map((line) => `- ${line.trim()}`)
							.join('\n')
					: value;
				content = replaceSection(content, key, body);
			}
			return content;
		});
		await writeAnkiFrontmatter(app, file, { anki_mod: info.mod });
		if (missing.length === 0) return undefined;
		const noun = missing.length === 1 ? 'field has' : 'fields have';
		return `${missing.length} Anki ${noun} no section in this note: ${missing.join(', ')}`;
	} catch (err) {
		throw toSyncError(err);
	}
}

// updateNoteFields reports success even when Anki keeps the old values — AnkiConnect's
// documented caveat: a note open in Anki's Browser/editor gets its stale content saved
// back over the update. Read the note back so that case isn't reported as synced.
// ponytail: compares every field after trimming; narrow to changed fields if Anki's own
// normalization ever causes false alarms.
// Returns the note's `mod` after the update, the new conflict baseline.
async function verifyUpdate(
	client: AnkiConnectClient,
	noteId: number,
	fields: Record<string, string>,
): Promise<number> {
	const stored = await client.noteInfo(noteId);
	if (!sameFields(fields, stored.fields)) {
		throw new SyncError(
			'stale-editor',
			'Anki kept the old content. Close this note in the Anki Browser and sync again.',
		);
	}
	return stored.mod;
}

export async function deleteNote(
	app: App,
	file: TFile,
	client: AnkiConnectClient,
): Promise<void> {
	const frontmatter = readAnkiFrontmatter(app, file);
	if (frontmatter?.anki_note_id === undefined) {
		throw new SyncError(
			'parse-error',
			'Cannot parse note content. Please check format.',
		);
	}

	try {
		await client.deleteNotes([frontmatter.anki_note_id]);
	} catch (err) {
		throw toSyncError(err);
	}

	await writeAnkiFrontmatter(app, file, {
		anki_note_id: undefined,
		anki_mod: undefined,
	});
}

function isNoteNotFound(err: unknown): boolean {
	return (
		err instanceof AnkiConnectError &&
		err.action === 'updateNoteFields' &&
		err.ankiMessage.startsWith('Note was not found:')
	);
}

// Maps AnkiConnect's raw error text to the exact user-facing strings in
// docs/design/01-sync.md §1.6. Anything not matching one of those 4 cases propagates
// unchanged rather than being mislabeled.
function toSyncError(err: unknown): unknown {
	if (!(err instanceof AnkiConnectError)) return err;

	if (
		err.ankiMessage === 'could not reach AnkiConnect — is Anki running?' ||
		err.ankiMessage.startsWith('timed out after')
	) {
		return new SyncError(
			'offline',
			'Anki is not running. Please start Anki and AnkiConnect.',
		);
	}
	if (err.ankiMessage === 'cannot create note because it is a duplicate') {
		return new SyncError('duplicate', 'Note already exists in Anki');
	}
	if (err.ankiMessage.startsWith('model was not found:')) {
		return new SyncError(
			'model-not-found',
			'Model not found in Anki. Please select it again.',
		);
	}
	return err;
}

async function createNote(
	app: App,
	file: TFile,
	client: AnkiConnectClient,
	frontmatter: AnkiFrontmatter,
	fields: Record<string, string>,
): Promise<void> {
	const noteId = await client.addNote({
		deckName: frontmatter.anki_deck,
		modelName: frontmatter.anki_model,
		fields,
		tags: frontmatter.tags,
	});
	const { mod } = await client.noteInfo(noteId);
	await writeAnkiFrontmatter(app, file, {
		anki_note_id: noteId,
		anki_mod: mod,
	});
}
