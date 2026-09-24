import type { App, TFile } from 'obsidian';
import { parseSections } from '../sync/parser';
import { resolveSectionKey } from './fillEmptySections';

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
// ponytail: 80 code points keeps CJK (3 bytes each) under the 255-byte file-name limit;
// a name made mostly of 4-byte emoji could still exceed it — cap by bytes if that shows up.
const MAX_NAME_LENGTH = 80;
// Characters a file name (OS / Obsidian) or an Obsidian [[link]] can't hold, swapped for
// their full-width lookalikes so the name still reads like the Main Field value.
const FULL_WIDTH: Record<string, string> = {
	'\\': '＼',
	'/': '／',
	':': '：',
	'*': '＊',
	'?': '？',
	'"': '＂',
	'<': '＜',
	'>': '＞',
	'|': '｜',
	'#': '＃',
	'^': '＾',
	'[': '［',
	']': '］',
};

// docs/contracts.md §5 — a note's file name keeps the text as written (spaces, Unicode,
// punctuation). What a file name or an Obsidian [[link]] can't hold becomes full-width.
// Media files use sanitizeForFilename (mediaNaming.ts) instead: Anki needs stricter names.
export function noteFilename(text: string): string {
	const name = text
		.normalize('NFC')
		// eslint-disable-next-line no-control-regex -- intentional: control characters can't be in a file name
		.replace(/[\u0000-\u001f\u007f]/g, ' ')
		.replace(/[\\/:*?"<>|#^[\]]/g, (c) => FULL_WIDTH[c] ?? c)
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^\.+/, ''); // no hidden files
	const truncated =
		Array.from(name).slice(0, MAX_NAME_LENGTH).join('').trim() || 'note';
	return WINDOWS_RESERVED_NAME.test(truncated) ? `${truncated}_` : truncated;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// docs/design/03-note.md §3.2 — after each Sync the note's file name follows its Main
// Field value, named the same way as at creation (noteFilename). No Main Field
// configured, or an empty one → the name is left alone.
export async function syncNoteName(
	app: App,
	file: TFile,
	mainField: string | undefined,
): Promise<void> {
	if (!mainField) return;
	const sections = parseSections(await app.vault.read(file));
	const key = resolveSectionKey(sections.keys(), mainField);
	const value = key === undefined ? '' : sections.get(key);
	const text = (Array.isArray(value) ? value.join('\n') : (value ?? ''))
		.replace(/<[^>]*>/g, '') // a Main Field pulled from Anki may carry <b>, <i>, …
		.split('\n')
		.map((line) => line.trim())
		.find((line) => line !== '');
	if (!text) return;

	const base = noteFilename(text);
	// "word 1" is already this name with Obsidian's collision suffix — don't bounce it.
	if (new RegExp(`^${escapeRegExp(base)}( \\d+)?$`).test(file.basename))
		return;

	const folder =
		!file.parent || file.parent.path === '/' ? '' : file.parent.path;
	await app.fileManager.renameFile(
		file,
		getUniqueNotePath(app, folder, `${base}.md`),
	);
}

// docs/design/03-note.md §3.7 step 5 — Obsidian's own numeric-suffix convention
// for name collisions ("word 1.md"); never overwrite, never error.
export function getUniqueNotePath(
	app: App,
	folder: string,
	filename: string,
): string {
	const base = filename.replace(/\.md$/, '');
	const join = (name: string) => (folder ? `${folder}/${name}` : name);

	let candidate = join(filename);
	for (let n = 1; app.vault.getAbstractFileByPath(candidate); n++) {
		candidate = join(`${base} ${n}.md`);
	}
	return candidate;
}
