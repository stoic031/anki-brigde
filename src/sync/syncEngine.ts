import type { App, TFile } from 'obsidian';
import type { AnkiConnectClient } from './ankiConnect';
import { readAnkiFrontmatter, parseSections, writeAnkiFrontmatter } from './parser';
import { mapContentToFields } from './fieldMapper';
import { AnkiConnectError, type AnkiFrontmatter } from '../types';

export async function syncNote(app: App, file: TFile, client: AnkiConnectClient): Promise<void> {
	const frontmatter = readAnkiFrontmatter(app, file);
	if (!frontmatter) throw new Error('Cannot parse note content: missing frontmatter.');

	const content = await app.vault.cachedRead(file);
	const sections = parseSections(content);
	const modelFields = await client.modelFieldNames(frontmatter.anki_model);
	const fields = mapContentToFields(sections, modelFields);

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
	}
}

function isNoteNotFound(err: unknown): boolean {
	return (
		err instanceof AnkiConnectError &&
		err.action === 'updateNoteFields' &&
		err.ankiMessage.startsWith('Note was not found:')
	);
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
