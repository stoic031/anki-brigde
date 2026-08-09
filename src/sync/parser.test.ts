import { describe, expect, it } from 'vitest';
import type { App, FrontMatterCache, TFile } from 'obsidian';
import { parseSections, readAnkiFrontmatter, writeAnkiFrontmatter } from './parser';

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

describe('parseSections', () => {
	it('extracts a text section as a trimmed string', () => {
		const sections = parseSections('## Word\n\n診察\n\n## Meaning\n\nKhám bệnh\n');
		expect(sections.get('word')).toBe('診察');
		expect(sections.get('meaning')).toBe('Khám bệnh');
	});

	it('extracts a list section as an array of trimmed items with the marker stripped', () => {
		const sections = parseSections('## Collocations\n\n- 診察を受ける\n- 診察室\n');
		expect(sections.get('collocations')).toEqual(['診察を受ける', '診察室']);
	});

	it('extracts a [sound:...] section verbatim as a string, not a list', () => {
		const sections = parseSections('## Audio\n\n[sound:_obsidian_診察_audio_1698765432.mp3]\n');
		expect(sections.get('audio')).toBe('[sound:_obsidian_診察_audio_1698765432.mp3]');
	});

	it('extracts an <img src="..."> section verbatim as a string', () => {
		const sections = parseSections('## Image\n\n<img src="_obsidian_診察_image_1698765433.png">\n');
		expect(sections.get('image')).toBe('<img src="_obsidian_診察_image_1698765433.png">');
	});

	it('maps an empty section to "", not undefined, and keeps the key present', () => {
		const sections = parseSections('## Word\n\n## Meaning\n\nKhám bệnh\n');
		expect(sections.get('word')).toBe('');
		expect(sections.has('word')).toBe(true);
	});

	it('ends the current section at a heading of the same or higher level', () => {
		const sections = parseSections('## Word\n\n診察\n\n# Unrelated\n\nnot a section\n');
		expect(sections.get('word')).toBe('診察');
		expect(sections.has('unrelated')).toBe(false);
	});

	it('keeps a deeper heading (###) as part of the enclosing section content', () => {
		const sections = parseSections('## Example\n\n診察を受けました。\n\n### Note\n\nInformal register.\n');
		expect(sections.get('example')).toBe('診察を受けました。\n\n### Note\n\nInformal register.');
	});
});

describe('parseSections edge cases', () => {
	it('returns an empty map for content with no headings at all', () => {
		const sections = parseSections('just some prose, no headings anywhere\nmore text\n');
		expect(sections.size).toBe(0);
	});

	it('ignores content before the first heading', () => {
		const sections = parseSections('orphan text before any heading\n\n## Word\n\n診察\n');
		expect(sections.size).toBe(1);
		expect(sections.get('word')).toBe('診察');
	});

	it('does not treat a hashes-plus-whitespace-only line as a section heading', () => {
		const sections = parseSections('## Word\n\n診察\n\n##   \n\nstray text\n');
		expect(sections.has('')).toBe(false);
		expect(sections.get('word')).toBe('診察\n\n##   \n\nstray text');
	});

	it('resolves back-to-back headings to an empty first section', () => {
		const sections = parseSections('## Word\n## Meaning\n\nKhám bệnh\n');
		expect(sections.get('word')).toBe('');
		expect(sections.get('meaning')).toBe('Khám bệnh');
	});

	it('keeps only the last occurrence of a duplicate heading, case-insensitively', () => {
		const sections = parseSections('## Example\n\nfirst\n\n## EXAMPLE\n\nsecond\n');
		expect(sections.size).toBe(1);
		expect(sections.get('example')).toBe('second');
	});

	it('maps a whitespace-only section body to "", not the whitespace itself', () => {
		const sections = parseSections('## Word\n\n   \n\t\n   \n\n## Meaning\n\nKhám bệnh\n');
		expect(sections.get('word')).toBe('');
	});

	it('preserves multi-line Japanese text and normalizes a Japanese heading key', () => {
		const sections = parseSections('## 読み方\n\nしんさつ\n診察を受けました。\n');
		expect(sections.get('読み方')).toBe('しんさつ\n診察を受けました。');
	});

	it('recognizes a Japanese list item with no space after the dash', () => {
		const sections = parseSections('## Collocations\n\n-診察を受ける\n-診察室\n');
		expect(sections.get('collocations')).toEqual(['診察を受ける', '診察室']);
	});
});
