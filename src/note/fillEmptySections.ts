import { FIELD_ALIASES } from '../utils/constants';

// docs/design/03-note.md §3.4 — same lookup as sync's field mapper passes 1+2: the exact
// field name first, then its aliases. Returns the matching lowercased heading, if any.
export function resolveSectionKey(
	headings: Iterable<string>,
	field: string,
): string | undefined {
	const existing = new Set(headings);
	const key = field.trim().toLowerCase();
	return [key, ...(FIELD_ALIASES[key] ?? [])].find((k) => existing.has(k));
}

export interface FillResult {
	content: string;
	filled: string[]; // field names written
	skipped: string[]; // field names whose section already had content
}

// Generate writes only into empty `## Field` sections; a section with content is never
// touched, a missing one is appended at the end, everything else stays byte for byte
// (.claude/rules/sync-engine.md). Empty result values are ignored.
export function fillEmptySections(
	content: string,
	results: Record<string, string>,
): FillResult {
	const eol = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(eol);
	const filled: string[] = [];
	const skipped: string[] = [];
	const appended: string[] = [];

	for (const [field, raw] of Object.entries(results)) {
		const text = raw.trim();
		if (text === '') continue;

		const headings = sectionHeadings(lines);
		const key = resolveSectionKey(
			headings.map((h) => h.key),
			field,
		);
		const heading = headings.find((h) => h.key === key);
		if (!heading) {
			appended.push(`## ${field.trim()}`, '', text, '');
			filled.push(field);
			continue;
		}
		const body = lines.slice(heading.line + 1, heading.end);
		if (body.some((l) => l.trim() !== '')) {
			skipped.push(field);
			continue;
		}
		// Insert above the existing blank lines so the rest of the file is byte-identical.
		lines.splice(
			heading.line + 1,
			0,
			'',
			text,
			...(body.length === 0 ? [''] : []),
		);
		filled.push(field);
	}

	if (appended.length > 0) {
		if (lines[lines.length - 1] !== '') lines.push('');
		lines.push(...appended);
	}
	return { content: lines.join(eol), filled, skipped };
}

// `end` is the line index of the next heading of level 1-2 (or EOF), matching how
// parseSections ends a section. Exported for applyImageTag.ts, which needs the same
// section boundaries.
export function sectionHeadings(
	lines: string[],
): { key: string; line: number; end: number }[] {
	const marks: { level: number; text: string; line: number }[] = [];
	lines.forEach((l, i) => {
		const m = /^(#{1,6})\s+(.+?)\s*$/.exec(l);
		if (m?.[1] && m[2] && m[1].length <= 2) {
			marks.push({ level: m[1].length, text: m[2], line: i });
		}
	});
	return marks.flatMap((m, i) =>
		m.level === 2
			? [
					{
						key: m.text.toLowerCase(),
						line: m.line,
						end: marks[i + 1]?.line ?? lines.length,
					},
				]
			: [],
	);
}
