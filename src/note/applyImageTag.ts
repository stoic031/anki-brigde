import { resolveSectionKey, sectionHeadings } from './fillEmptySections';

const IMG_TAG = /<img\s+src="[^"]*">/gi;

export type ImageTagMode = 'append' | 'overwrite';

// docs/design/03-note.md §3.4 — Add Image writes into the Output field's section only.
// Append keeps existing content and adds the new tag at the end of the section.
// Overwrite strips existing <img src="..."> tags from the section — keeping any other
// text the user wrote there — then adds the new one. A missing section is appended at
// the end of the note, same shape as fillEmptySections' "appended" case.
export function applyImageTag(
	content: string,
	field: string,
	tag: string,
	mode: ImageTagMode,
): string {
	const eol = content.includes('\r\n') ? '\r\n' : '\n';
	const lines = content.split(eol);
	const headings = sectionHeadings(lines);
	const key = resolveSectionKey(
		headings.map((h) => h.key),
		field,
	);
	const heading = headings.find((h) => h.key === key);

	if (!heading) {
		if (lines[lines.length - 1] !== '') lines.push('');
		lines.push(`## ${field.trim()}`, '', tag, '');
		return lines.join(eol);
	}

	const body = lines.slice(heading.line + 1, heading.end);
	const kept =
		mode === 'overwrite'
			? body
					.map((l) => l.replace(IMG_TAG, '').trimEnd())
					// Keep a line that still has content after stripping, or one that was
					// already blank before — drop only lines that held nothing but a tag.
					.filter((l, i) => l !== '' || body[i]!.trim() === '')
			: [...body];
	// Trailing blanks would otherwise stack with the separator below.
	while (kept.length > 0 && kept[kept.length - 1]?.trim() === '') kept.pop();

	// A blank line after the tag when another section follows: an HTML block runs until
	// a blank line in Markdown, so the next heading would otherwise render as part of it.
	const after = heading.end < lines.length ? [''] : [];
	lines.splice(heading.line + 1, body.length, ...kept, '', tag, ...after);
	return lines.join(eol);
}
