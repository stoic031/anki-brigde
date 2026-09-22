// docs/design/03-note.md §3.6 — one empty `## Field` section per model field, in
// modelFieldNames order. §3.7 step 6 reuses this with the first field pre-filled.
export function generateContentSkeleton(
	fields: string[],
	firstFieldContent = '',
): string {
	const sections = fields.map((field, i) =>
		i === 0 && firstFieldContent
			? `## ${field}\n\n${firstFieldContent}`
			: `## ${field}`,
	);
	return sections.length ? sections.join('\n\n') + '\n' : '';
}

// Replaces everything after the frontmatter with a fresh skeleton for `fields` — used
// when the user rebuilds a note's fields after changing its Model. Frontmatter is kept.
export function rebuildContent(content: string, fields: string[]): string {
	const frontmatter = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(
		content,
	)?.[0];
	const skeleton = generateContentSkeleton(fields);
	if (!frontmatter) return skeleton;
	return `${frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n'}\n${skeleton}`;
}
