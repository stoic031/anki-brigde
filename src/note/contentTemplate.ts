// docs/design/03-note.md §3.6 — one empty `## Field` section per model field, in
// modelFieldNames order. §3.7 reuses this with the Main Field pre-filled.
export interface FieldPrefill {
	field: string; // matched by exact name against `fields` — both come from modelFieldNames
	content: string;
}

export function generateContentSkeleton(
	fields: string[],
	prefill?: FieldPrefill,
): string {
	const sections = fields.map((field) =>
		field === prefill?.field && prefill.content
			? `## ${field}\n\n${prefill.content}`
			: `## ${field}`,
	);
	return sections.length ? sections.join('\n\n') + '\n' : '';
}

// Replaces everything after the frontmatter with a fresh skeleton for `fields` — used
// when the user rebuilds a note's fields after changing its Model. Frontmatter is kept.
export function rebuildContent(
	content: string,
	fields: string[],
	prefill?: FieldPrefill,
): string {
	const frontmatter = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(
		content,
	)?.[0];
	const skeleton = generateContentSkeleton(fields, prefill);
	if (!frontmatter) return skeleton;
	return `${frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n'}\n${skeleton}`;
}
