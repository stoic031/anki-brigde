import type { App, TFile } from 'obsidian';
import type { AnkiFrontmatter } from '../types';

export function readAnkiFrontmatter(app: App, file: TFile): AnkiFrontmatter | undefined {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter;
	if (!fm) return undefined;

	return {
		anki_note_id: typeof fm.anki_note_id === 'number' ? fm.anki_note_id : undefined,
		anki_deck: typeof fm.anki_deck === 'string' ? fm.anki_deck : '',
		anki_model: typeof fm.anki_model === 'string' ? fm.anki_model : '',
		last_synced: typeof fm.last_synced === 'string' ? fm.last_synced : undefined,
		tags: Array.isArray(fm.tags) ? fm.tags : undefined,
	};
}

export async function writeAnkiFrontmatter(
	app: App,
	file: TFile,
	updates: Partial<AnkiFrontmatter>,
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
		for (const [key, value] of Object.entries(updates)) {
			// last_synced is display-only — callers write it, sync logic must never read it back (docs/contracts.md §1)
			if (value === undefined) delete frontmatter[key];
			else frontmatter[key] = value;
		}
	});
}
