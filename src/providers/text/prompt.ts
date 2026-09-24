import type { ApprovedCard, TextContext, TextTask } from '../types';

// One shared look so a deck's pictures match; cheap for SD-style models to follow.
export const IMAGE_STYLE =
	'flat vector illustration, clean lines, soft colors, plain white background';

// Worked examples for build-image-prompt, one per kind of item (word or spoken phrase) — small local text models
// follow examples far better than rules. `prompt` gets IMAGE_STYLE appended.
const IMAGE_EXAMPLES = [
	{
		input: 'Word: 薬 / Meaning: medicine',
		idea: 'medicine: a sick man taking a pill',
		prompt: 'a sick young man in pajamas swallowing a white pill with a glass of water, pale tired face, medium shot',
	},
	{
		input: 'Word: 走る / Meaning: to run',
		idea: 'to run: a boy sprinting',
		prompt: 'a boy sprinting with long strides, arms pumping, hair blown back, determined face, full body',
	},
	{
		input: 'Word: Term / Definition: thuật ngữ; thời hạn / Ex: 契約期間は一年です',
		idea: 'technical term (first sense): jargon that confuses a listener',
		prompt: 'a doctor in a white coat talking with a raised finger while a confused patient frowns and scratches his head, medium shot',
	},
	{
		input: 'Word: 懐かしい / Meaning: nostalgic',
		idea: 'nostalgic: an old woman moved by a childhood toy',
		prompt: 'an old woman smiling with teary eyes, holding a small wooden toy from her childhood, warm light, medium shot',
	},
	{
		input: 'Phrase: お疲れ様です / Meaning: good work today (said to coworkers)',
		idea: 'greeting coworkers at the end of the workday',
		prompt: 'two office coworkers bowing slightly to each other at the end of the workday, tired but warm smiles, one holding a bag, medium shot',
	},
];

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
	// docs/design/02-providers.md §2.4 — a picture that lets a learner recall the word at a
	// glance. Works on CLIP-based models (SD 1.5/SDXL via ComfyUI/A1111: ~75-token window,
	// front-weighted, draws any noun it sees — hence never naming "text", even negated) as
	// well as Flux/DALL·E/Gemini. `idea` comes first in the JSON so the model plans before
	// writing the prompt.
	'build-image-prompt': [
		"You design the picture for a vocabulary flashcard. A learner sees only the picture and must recall the word, so it must show the word's meaning at a glance: clear, concrete and memorable.",
		'The input lists the card\'s fields as "Field: value". Work in this order:',
		'1. The first line is the item to learn: a word, or a short spoken phrase/sentence. For a word, pick the first sense in the definition/meaning field. Example-sentence fields only help you understand it; never draw them.',
		'2. Find ONE visual idea that shows that sense and nothing close to it:',
		'- Thing → the thing itself, whole, in its typical use.',
		'- Action → one person caught mid-action; the pose makes the action unmistakable.',
		'- Quality → one exaggerated example, e.g. "heavy" → a man straining to lift a huge boulder.',
		'- Feeling → a face and body showing it, plus its typical cause.',
		'- Abstract idea → the most typical everyday moment people experience it, with a person reacting.',
		'- Spoken phrase (greeting, thanks, apology, request, question, set phrase) → the moment it is said: the speaker mid-gesture with the matching expression, the listener reacting, in the place it is typically said. Show the intent through gesture (bowing, waving, handing something over, pointing the way).',
		'Prefer exaggerated, emotional or slightly funny scenes: they are remembered better. The idea must work without any writing, numbers or symbols.',
		'3. Write "idea": one short English line with the sense you chose and the visual idea.',
		'4. Write "prompt" by these rules:',
		'- English, one line, 20-50 words, a plain description of the picture. Some image models read only the first ~70 tokens, so the most important words go first.',
		`- Order: subject + action, then 1-2 key details (expression, key object), then framing (close-up for small objects, full body for actions, medium shot otherwise), then end with exactly: ${IMAGE_STYLE}`,
		'- One focal subject, few objects, empty background.',
		'- Describe only what is visible. Never mention text, letters, words, numbers, labels, captions, signs or speech bubbles, not even to exclude them: image models draw whatever is named. Avoid things that are mostly writing or numbers (calendars, clocks, pages, documents, books, signs, screens, charts, maps) and diagram marks (arrows, boxes, highlights, check marks, icons).',
		'- Generic people only ("a young woman", "an old man"); no real people, brands, logos or copyrighted characters.',
		'- No weights like (word:1.2), no quotes, no markdown.',
		'Examples:',
		...IMAGE_EXAMPLES.flatMap(({ input, idea, prompt }) => [
			`${input} →`,
			JSON.stringify({ idea, prompt: `${prompt}, ${IMAGE_STYLE}` }),
		]),
	].join('\n'),
};

export const IMAGE_PROMPT_KEY = 'prompt';
// Planning line the model writes before the prompt; never used downstream.
const IMAGE_IDEA_KEY = 'idea';

// docs/design/07-sidebar.md §7.2.1 — shown in the Text tab's Prompt box as the starting
// point the user edits.
export function defaultInstruction(task: TextTask): string {
	return TASK_INSTRUCTION[task];
}

// build-image-prompt has no target fields — its keys are `idea` (planning) then `prompt`.
export function resultKeys(task: TextTask, targetFields: string[]): string[] {
	return task === 'build-image-prompt'
		? [IMAGE_IDEA_KEY, IMAGE_PROMPT_KEY]
		: targetFields;
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
	// docs/design/02-providers.md §2.4 — the user may replace only the instruction; the
	// language/context/examples/JSON lines below are always appended, so a bad edit
	// can't break parsing.
	const instruction = context?.instruction?.trim() || TASK_INSTRUCTION[task];
	const system = [
		instruction,
		...(languageRule ? [languageRule] : []),
		...(contextLine ? [contextLine] : []),
		...(examples ? [examples] : []),
		`Reply with ONLY a JSON object whose keys are exactly: ${JSON.stringify(keys)}.`,
		'Every value is a string. Omit a key if you cannot fill it. No markdown, no commentary.',
	].join('\n');
	return { system, user: input };
}
