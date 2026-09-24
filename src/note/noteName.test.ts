import { describe, expect, it, vi } from 'vitest';
import type { App, TFile } from 'obsidian';

import { noteFilename, syncNoteName } from './noteName';

function setup(content: string, opts: { basename?: string; folder?: string; taken?: string[] } = {}) {
	const basename = opts.basename ?? 'old';
	const folder = opts.folder ?? 'Vocab';
	const file = { basename, parent: { path: folder } } as unknown as TFile;
	const renameFile = vi.fn().mockResolvedValue(undefined);
	const taken = new Set(opts.taken ?? []);
	const app = {
		vault: {
			read: async () => content,
			getAbstractFileByPath: (p: string) => (taken.has(p) ? {} : null),
		},
		fileManager: { renameFile },
	} as unknown as App;
	return { app, file, renameFile };
}

const NOTE = '## Front\n\n診察 室\n\n## Back\n\nexam\n';

describe('syncNoteName', () => {
	it('renames the note to the sanitized Main Field value', async () => {
		const { app, file, renameFile } = setup(NOTE);
		await syncNoteName(app, file, 'Front');
		expect(renameFile).toHaveBeenCalledWith(file, 'Vocab/診察 室.md');
	});

	it('finds the Main Field through its aliases', async () => {
		const { app, file, renameFile } = setup('## Word\n\n薬\n');
		await syncNoteName(app, file, 'Front');
		expect(renameFile).toHaveBeenCalledWith(file, 'Vocab/薬.md');
	});

	it.each(['診察 室', '診察 室 1'])('leaves "%s" alone', async (basename) => {
		const { app, file, renameFile } = setup(NOTE, { basename });
		await syncNoteName(app, file, 'Front');
		expect(renameFile).not.toHaveBeenCalled();
	});

	it('adds a numeric suffix when the name is taken by another note', async () => {
		const { app, file, renameFile } = setup(NOTE, { taken: ['Vocab/診察 室.md'] });
		await syncNoteName(app, file, 'Front');
		expect(renameFile).toHaveBeenCalledWith(file, 'Vocab/診察 室 1.md');
	});

	it('strips HTML and uses the first non-empty line', async () => {
		const { app, file, renameFile } = setup('## Front\n\n<b>薬</b>\nsecond line\n');
		await syncNoteName(app, file, 'Front');
		expect(renameFile).toHaveBeenCalledWith(file, 'Vocab/薬.md');
	});

	it('puts a note in the vault root at the root, no leading slash', async () => {
		const { app, file, renameFile } = setup(NOTE, { folder: '/' });
		await syncNoteName(app, file, 'Front');
		expect(renameFile).toHaveBeenCalledWith(file, '診察 室.md');
	});

	it.each([
		['no Main Field configured', NOTE, undefined],
		['an empty Main Field', '## Front\n\n\n## Back\n\nexam\n', 'Front'],
		['a Main Field with no section', NOTE, 'Reading'],
	])('does nothing with %s', async (_label, content, mainField) => {
		const { app, file, renameFile } = setup(content);
		await syncNoteName(app, file, mainField);
		expect(renameFile).not.toHaveBeenCalled();
	});
});

describe('noteFilename', () => {
	it('keeps spaces, Unicode and ordinary punctuation', () => {
		expect(noteFilename("look up, isn't (it)! 診察")).toBe("look up, isn't (it)! 診察");
	});

	it('swaps characters a file name or an Obsidian link cannot hold for full-width ones', () => {
		expect(noteFilename('おなまえは ?')).toBe('おなまえは ？');
		expect(noteFilename('a/b\\c:d*e?f"g<h>i|j#k^l[m]n')).toBe('a／b＼c：d＊e？f＂g＜h＞i｜j＃k＾l［m］n');
	});

	it('turns line breaks and whitespace runs into one space, trimmed', () => {
		expect(noteFilename('  go\n  out \t now ')).toBe('go out now');
	});

	it.each(['', '...', ' \t '])('falls back to "note" for %j', (input) => {
		expect(noteFilename(input)).toBe('note');
	});

	it('suffixes Windows reserved names', () => {
		expect(noteFilename('con')).toBe('con_');
	});

	it('caps the length at 80 characters', () => {
		expect(noteFilename('診'.repeat(200))).toBe('診'.repeat(80));
	});
});
