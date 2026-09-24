import type { App, TFile } from 'obsidian';
import type { AnkiFrontmatter, SectionValue } from '../types';

export function readAnkiFrontmatter(
	app: App,
	file: TFile,
): AnkiFrontmatter | undefined {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter;
	if (!fm) return undefined;

	return {
		anki_note_id:
			typeof fm.anki_note_id === 'number' ? fm.anki_note_id : undefined,
		anki_deck: typeof fm.anki_deck === 'string' ? fm.anki_deck : '',
		anki_model: typeof fm.anki_model === 'string' ? fm.anki_model : '',
		last_synced:
			typeof fm.last_synced === 'string' ? fm.last_synced : undefined,
		anki_mod: typeof fm.anki_mod === 'number' ? fm.anki_mod : undefined,
		tags: Array.isArray(fm.tags) ? fm.tags : undefined,
	};
}

export async function writeAnkiFrontmatter(
	app: App,
	file: TFile,
	updates: Partial<AnkiFrontmatter>,
): Promise<void> {
	await app.fileManager.processFrontMatter(
		file,
		(frontmatter: Record<string, unknown>) => {
			for (const [key, value] of Object.entries(updates)) {
				// last_synced is display-only — callers write it, sync logic must never read it back (docs/contracts.md §1)
				if (value === undefined) delete frontmatter[key];
				else frontmatter[key] = value;
			}
		},
	);
}

const AUDIO_TAG = /^\[sound:[^\]]+\]$/;
const IMAGE_TAG = /^<img\s+src="[^"]+">$/;

export function parseSections(content: string): Map<string, SectionValue> {
	const sections = new Map<string, SectionValue>();
	const lines = content.split('\n');
	let currentKey: string | null = null;
	let buffer: string[] = [];

	const commit = () => {
		if (currentKey !== null)
			sections.set(currentKey, extractSectionValue(buffer.join('\n')));
	};

	for (const line of lines) {
		const heading = sectionHeading(line);
		if (heading !== undefined) {
			// a heading of the same or higher level ends the current section (.claude/rules/sync-engine.md)
			commit();
			currentKey = heading;
			buffer = [];
			continue;
		}
		if (currentKey !== null) buffer.push(line);
	}
	commit();

	return sections;
}

// Normalized key for a `## ` heading, null for a `# ` heading (ends a section without
// starting one), undefined for any other line.
function sectionHeading(line: string): string | null | undefined {
	const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
	const text = heading?.[2]?.trim();
	const level = heading?.[1]?.length;
	if (level === undefined || !text || level > 2) return undefined;
	return level === 2 ? text.toLowerCase() : null;
}

// Replaces the body of the first `## ` section whose normalized key is `key`, keeping its
// heading. Returns the content unchanged when there is no such section.
export function replaceSection(
	content: string,
	key: string,
	body: string,
): string {
	const lines = content.split('\n');
	const start = lines.findIndex((line) => sectionHeading(line) === key);
	if (start === -1) return content;
	let end = start + 1;
	while (end < lines.length && sectionHeading(lines[end] ?? '') === undefined)
		end++;
	return [
		...lines.slice(0, start + 1),
		'',
		...body.split('\n'),
		'',
		...lines.slice(end),
	].join('\n');
}

function extractSectionValue(raw: string): SectionValue {
	const trimmed = raw.trim();
	if (trimmed === '') return '';
	if (AUDIO_TAG.test(trimmed)) return trimmed;
	if (IMAGE_TAG.test(trimmed)) return trimmed;

	const bulletItems = trimmed
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('-'))
		.map((line) => line.slice(1).trim());
	if (bulletItems.length > 0) return bulletItems;

	return trimmed;
}
