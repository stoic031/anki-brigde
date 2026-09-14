import { CONTROLS_BLOCK_LANGUAGE } from '../utils/constants';

// docs/design/03-note.md §3.6 — one empty `## Field` section per model field, in modelFieldNames order
export function generateContentSkeleton(fields: string[]): string {
	const controlsBlock = `\`\`\`${CONTROLS_BLOCK_LANGUAGE}\n\`\`\``;
	const sections = fields.map((field) => `## ${field}`);
	return [controlsBlock, ...sections].join('\n\n') + '\n';
}
