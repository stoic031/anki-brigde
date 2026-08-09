import { describe, expect, it } from 'vitest';
import type { App, FrontMatterCache, TFile } from 'obsidian';
import { readAnkiFrontmatter, writeAnkiFrontmatter } from './parser';

function fakeReaderApp(frontmatter: FrontMatterCache | undefined): App {
	return {
		metadataCache: {
			getFileCache: () => (frontmatter ? { frontmatter } : null),
		},
	} as unknown as App;
}

function fakeWriterApp(initial: Record<string, unknown>) {
	const frontmatter: Record<string, unknown> = { ...initial };
	const app = {
		fileManager: {
			processFrontMatter: async (_file: TFile, fn: (fm: Record<string, unknown>) => void) => {
				fn(frontmatter);
			},
		},
	} as unknown as App;
	return { app, frontmatter };
}

const file = {} as unknown as TFile;

describe('readAnkiFrontmatter', () => {
	it('returns undefined when the note has no frontmatter block at all', () => {
		expect(readAnkiFrontmatter(fakeReaderApp(undefined), file)).toBeUndefined();
	});

	it('reads a note without anki_note_id as undefined for that field, without throwing', () => {
		const app = fakeReaderApp({ anki_deck: 'Japanese::N2', anki_model: 'Basic' });
		expect(() => readAnkiFrontmatter(app, file)).not.toThrow();
		expect(readAnkiFrontmatter(app, file)).toEqual({
			anki_note_id: undefined,
			anki_deck: 'Japanese::N2',
			anki_model: 'Basic',
			last_synced: undefined,
			tags: undefined,
		});
	});

	it('reads all known fields when present', () => {
		const app = fakeReaderApp({
			anki_note_id: 1698765432109,
			anki_deck: 'Japanese::N2',
			anki_model: 'Basic (and reversed card)',
			last_synced: '2023-10-27T10:30:00Z',
			tags: ['vocabulary', 'medical'],
		});
		expect(readAnkiFrontmatter(app, file)).toEqual({
			anki_note_id: 1698765432109,
			anki_deck: 'Japanese::N2',
			anki_model: 'Basic (and reversed card)',
			last_synced: '2023-10-27T10:30:00Z',
			tags: ['vocabulary', 'medical'],
		});
	});

	it('ignores frontmatter keys unrelated to Anki', () => {
		const app = fakeReaderApp({ anki_deck: 'Deck', anki_model: 'Model', custom_key: 'foo' });
		expect(readAnkiFrontmatter(app, file)).not.toHaveProperty('custom_key');
	});
});

describe('writeAnkiFrontmatter', () => {
	it('writing anki_note_id does not delete or reorder other frontmatter keys', async () => {
		const { app, frontmatter } = fakeWriterApp({
			custom_key: 'foo',
			anki_deck: 'Japanese::N2',
			anki_model: 'Basic',
		});
		await writeAnkiFrontmatter(app, file, { anki_note_id: 1698765432109 });
		expect(frontmatter).toEqual({
			custom_key: 'foo',
			anki_deck: 'Japanese::N2',
			anki_model: 'Basic',
			anki_note_id: 1698765432109,
		});
		expect(Object.keys(frontmatter)).toEqual(['custom_key', 'anki_deck', 'anki_model', 'anki_note_id']);
	});

	it('stores last_synced exactly as the ISO 8601 string it is given', async () => {
		const { app, frontmatter } = fakeWriterApp({});
		const iso = '2023-10-27T10:30:00.000Z';
		await writeAnkiFrontmatter(app, file, { last_synced: iso });
		expect(frontmatter.last_synced).toBe(iso);
	});

	it('deletes a key when its update value is undefined', async () => {
		const { app, frontmatter } = fakeWriterApp({ anki_note_id: 123, anki_deck: 'Deck' });
		await writeAnkiFrontmatter(app, file, { anki_note_id: undefined });
		expect(frontmatter).toEqual({ anki_deck: 'Deck' });
	});
});
