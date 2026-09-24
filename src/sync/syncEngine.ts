import type { App, TFile } from 'obsidian';
import type { AnkiConnectClient } from './ankiConnect';
import { readAnkiFrontmatter, parseSections, writeAnkiFrontmatter } from './parser';
import { mapContentToFields } from './fieldMapper';
import { AnkiConnectError, SyncError, type AnkiFrontmatter } from '../types';

export async function syncNote(app: App, file: TFile, client: AnkiConnectClient): Promise<void> {
	const frontmatter = readAnkiFrontmatter(app, file);
	if (!frontmatter) {
		throw new SyncError('parse-error', 'Cannot parse note content. Please check format.');
	}

	try {
		const content = await app.vault.cachedRead(file);
		const sections = parseSections(content);
		const modelFields = await client.modelFieldNames(frontmatter.anki_model);
		const { fields } = mapContentToFields(sections, modelFields, frontmatter.anki_model);

		if (frontmatter.anki_note_id === undefined) {
			await createNote(app, file, client, frontmatter, fields);
			return;
		}

		try {
			await client.updateNoteFields(frontmatter.anki_note_id, fields);
		} catch (err) {
			if (!isNoteNotFound(err)) throw err;
			// AnkiConnect reports the note is gone — clear the stale ID and recreate it
			// so sync stays idempotent instead of surfacing a hard error (#56).
			await writeAnkiFrontmatter(app, file, { anki_note_id: undefined });
			await createNote(app, file, client, frontmatter, fields);
			return;
		}
		await verifyUpdate(client, frontmatter.anki_note_id, fields);
	} catch (err) {
		throw toSyncError(err);
	}
}

// updateNoteFields reports success even when Anki keeps the old values — AnkiConnect's
// documented caveat: a note open in Anki's Browser/editor gets its stale content saved
// back over the update. Read the note back so that case isn't reported as synced.
// ponytail: compares every field after trimming; narrow to changed fields if Anki's own
// normalization ever causes false alarms.
async function verifyUpdate(client: AnkiConnectClient, noteId: number, fields: Record<string, string>): Promise<void> {
	const stored = await client.noteFields(noteId);
	const stale = Object.entries(fields).some(([name, value]) => (stored[name] ?? '').trim() !== value.trim());
	if (stale) {
		throw new SyncError('stale-editor', 'Anki kept the old content. Close this note in the Anki Browser and sync again.');
	}
}

export async function deleteNote(app: App, file: TFile, client: AnkiConnectClient): Promise<void> {
	const frontmatter = readAnkiFrontmatter(app, file);
	if (frontmatter?.anki_note_id === undefined) {
		throw new SyncError('parse-error', 'Cannot parse note content. Please check format.');
	}

	try {
		await client.deleteNotes([frontmatter.anki_note_id]);
	} catch (err) {
		throw toSyncError(err);
	}

	await writeAnkiFrontmatter(app, file, { anki_note_id: undefined });
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
		return new SyncError('offline', 'Anki is not running. Please start Anki and AnkiConnect.');
	}
	if (err.ankiMessage === 'cannot create note because it is a duplicate') {
		return new SyncError('duplicate', 'Note already exists in Anki');
	}
	if (err.ankiMessage.startsWith('model was not found:')) {
		return new SyncError('model-not-found', 'Model not found in Anki. Please select it again.');
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
	await writeAnkiFrontmatter(app, file, { anki_note_id: noteId });
}
