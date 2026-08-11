import type { App, TFile } from 'obsidian';
import type { AnkiConnectClient } from './ankiConnect';
import { readAnkiFrontmatter, parseSections, writeAnkiFrontmatter } from './parser';
import { mapContentToFields } from './fieldMapper';

export async function syncNote(app: App, file: TFile, client: AnkiConnectClient): Promise<void> {
	const frontmatter = readAnkiFrontmatter(app, file);
	if (!frontmatter) throw new Error('Cannot parse note content: missing frontmatter.');

	const content = await app.vault.cachedRead(file);
	const sections = parseSections(content);
	const modelFields = await client.modelFieldNames(frontmatter.anki_model);
	const fields = mapContentToFields(sections, modelFields);

	if (frontmatter.anki_note_id === undefined) {
		const noteId = await client.addNote({
			deckName: frontmatter.anki_deck,
			modelName: frontmatter.anki_model,
			fields,
			tags: frontmatter.tags,
		});
		await writeAnkiFrontmatter(app, file, { anki_note_id: noteId });
	} else {
		await client.updateNoteFields(frontmatter.anki_note_id, fields);
	}
}
