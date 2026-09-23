import type { TextContext, TextTask } from '../types';

const TASK_INSTRUCTION: Record<TextTask, string> = {
	'extract-vocabulary':
		'Given a vocabulary word or phrase, fill in the requested fields (meaning, reading, notes, etc.).',
	'generate-example':
		'Given a vocabulary word or phrase, write natural example content for the requested fields.',
	rewrite:
		'Rewrite the given text so it fills the requested fields more clearly.',
	'build-image-prompt':
		'The input lists the fields of a vocabulary flashcard. Write ONE concise prompt for an image generation model that would produce a memorable illustration of the card. The prompt must be in English and must not ask for text inside the image.',
};

export const IMAGE_PROMPT_KEY = 'prompt';

// build-image-prompt has no target fields — its single result key is `prompt`.
export function resultKeys(task: TextTask, targetFields: string[]): string[] {
	return task === 'build-image-prompt' ? [IMAGE_PROMPT_KEY] : targetFields;
}

// docs/design/02-providers.md §2.4 — 'build-image-prompt' always stays English-only
// (docs/design-open-questions.md #19), so it never gets a language context line
// regardless of what's passed.
function buildContextLine(
	task: TextTask,
	context?: TextContext,
): string | undefined {
	if (task === 'build-image-prompt') return undefined;
	const target = context?.targetLanguage?.trim();
	const native = context?.nativeLanguage?.trim();
	if (!target && !native) return undefined;
	const parts: string[] = [];
	if (target) parts.push(`is learning ${target}`);
	if (native) parts.push(`explains best in ${native}`);
	return `Context: the user ${parts.join(' and ')}.`;
}

export function buildMessages(
	input: string,
	task: TextTask,
	targetFields: string[],
	context?: TextContext,
): { system: string; user: string } {
	const keys = resultKeys(task, targetFields);
	const contextLine = buildContextLine(task, context);
	const system = [
		TASK_INSTRUCTION[task],
		...(contextLine ? [contextLine] : []),
		`Reply with ONLY a JSON object whose keys are exactly: ${JSON.stringify(keys)}.`,
		'Every value is a string. Omit a key if you cannot fill it. No markdown, no commentary.',
	].join('\n');
	return { system, user: input };
}
