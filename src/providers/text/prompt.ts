import type { TextTask } from '../types';

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

export function buildMessages(
	input: string,
	task: TextTask,
	targetFields: string[],
): { system: string; user: string } {
	const keys = resultKeys(task, targetFields);
	const system = [
		TASK_INSTRUCTION[task],
		`Reply with ONLY a JSON object whose keys are exactly: ${JSON.stringify(keys)}.`,
		'Every value is a string. Omit a key if you cannot fill it. No markdown, no commentary.',
	].join('\n');
	return { system, user: input };
}
