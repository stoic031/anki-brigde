import { CONTROLS_BLOCK_LANGUAGE } from '../utils/constants';

// docs/design/03-note.md §3.6 — one empty `## Field` section per model field, in
// modelFieldNames order. §3.7 step 6 reuses this with the first field pre-filled.
export function generateContentSkeleton(
	fields: string[],
	firstFieldContent = '',
): string {
	const controlsBlock = `\`\`\`${CONTROLS_BLOCK_LANGUAGE}\n\`\`\``;
	const sections = fields.map((field, i) =>
		i === 0 && firstFieldContent
			? `## ${field}\n\n${firstFieldContent}`
			: `## ${field}`,
	);
	return [controlsBlock, ...sections].join('\n\n') + '\n';
}
