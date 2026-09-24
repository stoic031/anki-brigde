import type { ApprovedCard, TextContext, TextTask } from '../types';

const TASK_INSTRUCTION: Record<TextTask, string> = {
	'extract-vocabulary': [
		'You fill in the fields of a vocabulary flashcard used for spaced-repetition review. The input is the word or phrase.',
		'Rules:',
		'- Be brief: a card is read in seconds. A meaning field = the 1-3 most common senses, a few words each. An example field = ONE short natural sentence. Any other field = one short line.',
		'- Infer each field\'s purpose from its name (e.g. Definition or a field ending in "meaning" = explanation/translation, POS = part of speech, Ex1/Example = an example sentence).',
		'- No filler, no labels like "Meaning:", no repeating the word unless the field asks for it, no markdown.',
		"- If a field doesn't apply or you are unsure, omit it.",
	].join('\n'),
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

// docs/design/02-providers.md §2.4 — the Learning language wins over the input word's
// own language, so switching profile switches the output even for the same word.
function buildLanguageRule(
	task: TextTask,
	target?: string,
): string | undefined {
	if (task !== 'extract-vocabulary') return undefined;
	const examplesIn = target?.trim()
		? `${target.trim()}, even if the input word is in another language (use the ${target.trim()} equivalent)`
		: 'the same language as the input word';
	return `- Example sentences are in ${examplesIn}. Definitions, meanings and translations are in the user's language.`;
}

// Keeps a few long approved values from blowing up every prompt.
const EXAMPLE_VALUE_MAX = 300;

// docs/design/02-providers.md §2.4 — cards the user already wrote for this Deck+Model,
// so the model copies their style and length. Only for extract-vocabulary.
function buildExamplesBlock(
	task: TextTask,
	examples?: ApprovedCard[],
): string | undefined {
	if (task !== 'extract-vocabulary' || !examples?.length) return undefined;
	const lines = examples.map((ex) => {
		const fields = Object.fromEntries(
			Object.entries(ex.fields).map(([k, v]) => [
				k,
				v.slice(0, EXAMPLE_VALUE_MAX),
			]),
		);
		return `${ex.word} → ${JSON.stringify(fields)}`;
	});
	return [
		'Cards this user approved. Match their style and length:',
		...lines,
	].join('\n');
}

export function buildMessages(
	input: string,
	task: TextTask,
	targetFields: string[],
	context?: TextContext,
): { system: string; user: string } {
	const keys = resultKeys(task, targetFields);
	const languageRule = buildLanguageRule(task, context?.targetLanguage);
	const contextLine = buildContextLine(task, context);
	const examples = buildExamplesBlock(task, context?.examples);
	const system = [
		TASK_INSTRUCTION[task],
		...(languageRule ? [languageRule] : []),
		...(contextLine ? [contextLine] : []),
		...(examples ? [examples] : []),
		`Reply with ONLY a JSON object whose keys are exactly: ${JSON.stringify(keys)}.`,
		'Every value is a string. Omit a key if you cannot fill it. No markdown, no commentary.',
	].join('\n');
	return { system, user: input };
}
