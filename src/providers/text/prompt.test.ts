import { describe, expect, it } from 'vitest';
import {
	buildMessages,
	defaultInstruction,
	IMAGE_STYLE,
	resultKeys,
	IMAGE_PROMPT_KEY,
} from './prompt';

describe('resultKeys', () => {
	it('is targetFields for a normal task', () => {
		expect(
			resultKeys('extract-vocabulary', ['Meaning', 'Furigana']),
		).toEqual(['Meaning', 'Furigana']);
	});

	it('is always [idea, prompt] for build-image-prompt, ignoring targetFields', () => {
		expect(resultKeys('build-image-prompt', ['Meaning'])).toEqual([
			'idea',
			IMAGE_PROMPT_KEY,
		]);
	});
});

describe('buildMessages', () => {
	it('passes input through as the user message, untouched', () => {
		const { user } = buildMessages('薬', 'extract-vocabulary', ['Meaning']);
		expect(user).toBe('薬');
	});

	it('has no context line when context is omitted', () => {
		const { system } = buildMessages('薬', 'extract-vocabulary', [
			'Meaning',
		]);
		expect(system).not.toContain('Context:');
	});

	it('has no context line when context is present but both fields are empty', () => {
		const { system } = buildMessages(
			'薬',
			'extract-vocabulary',
			['Meaning'],
			{
				targetLanguage: '',
				nativeLanguage: '  ',
			},
		);
		expect(system).not.toContain('Context:');
	});

	it('adds a context line with only targetLanguage set', () => {
		const { system } = buildMessages(
			'薬',
			'extract-vocabulary',
			['Meaning'],
			{
				targetLanguage: 'Japanese',
			},
		);
		expect(system).toContain('Context: the user is learning Japanese.');
	});

	it('adds a context line with only nativeLanguage set', () => {
		const { system } = buildMessages(
			'薬',
			'extract-vocabulary',
			['Meaning'],
			{
				nativeLanguage: 'English',
			},
		);
		expect(system).toContain('Context: the user explains best in English.');
	});

	it('combines both when set', () => {
		const { system } = buildMessages(
			'薬',
			'extract-vocabulary',
			['Meaning'],
			{
				targetLanguage: 'Japanese',
				nativeLanguage: 'English',
			},
		);
		expect(system).toContain(
			'Context: the user is learning Japanese and explains best in English.',
		);
	});

	it('never adds a context line for build-image-prompt, even with context set', () => {
		const { system } = buildMessages('Word: 薬', 'build-image-prompt', [], {
			targetLanguage: 'Japanese',
			nativeLanguage: 'English',
		});
		expect(system).not.toContain('Context:');
		expect(system).not.toContain('Japanese');
	});

	it('always instructs replying with exactly the result keys as JSON', () => {
		const { system } = buildMessages('薬', 'rewrite', ['Front', 'Back']);
		expect(system).toContain(
			'Reply with ONLY a JSON object whose keys are exactly: ["Front","Back"]',
		);
	});

	it('tells extract-vocabulary to keep flashcard fields brief', () => {
		const { system } = buildMessages('薬', 'extract-vocabulary', [
			'Meaning',
		]);
		expect(system).toContain('Be brief');
		expect(system).toContain(
			'Example sentences are in the same language as the input word.',
		);
	});

	it('writes examples in the Learning language even for a word in another language', () => {
		const { system } = buildMessages(
			'note',
			'extract-vocabulary',
			['Ex1'],
			{ targetLanguage: 'Japanese' },
		);
		expect(system).toContain(
			'Example sentences are in Japanese, even if the input word is in another language',
		);
		expect(system).not.toContain('same language as the input word');
		expect(system).not.toContain('Furigana');
	});

	it("adds the user's approved cards as examples, truncating long values", () => {
		const { system } = buildMessages(
			'水',
			'extract-vocabulary',
			['Meaning'],
			{
				examples: [
					{ word: '薬', fields: { Meaning: 'medicine' } },
					{ word: '火', fields: { Meaning: 'x'.repeat(400) } },
				],
			},
		);
		expect(system).toContain('Match their style and length');
		expect(system).toContain('薬 → {"Meaning":"medicine"}');
		expect(system).toContain(`"${'x'.repeat(300)}"`);
		expect(system).not.toContain('x'.repeat(301));
	});

	it('has no examples block without examples or for other tasks', () => {
		const examples = [{ word: '薬', fields: { Meaning: 'medicine' } }];
		expect(
			buildMessages('薬', 'extract-vocabulary', ['Meaning']).system,
		).not.toContain('approved');
		expect(
			buildMessages('Word: 薬', 'build-image-prompt', [], { examples })
				.system,
		).not.toContain('approved');
	});
});

describe('buildMessages — custom instruction', () => {
	it('replaces the default instruction but keeps the JSON contract', () => {
		const { system } = buildMessages(
			'薬',
			'extract-vocabulary',
			['Meaning'],
			{
				instruction: 'Answer like a pirate.',
				targetLanguage: 'Japanese',
			},
		);

		expect(system.startsWith('Answer like a pirate.\n')).toBe(true);
		expect(system).not.toContain(defaultInstruction('extract-vocabulary'));
		expect(system).toContain('Example sentences are in Japanese');
		expect(system).toContain('keys are exactly: ["Meaning"]');
	});

	it('falls back to the default when the instruction is blank', () => {
		const { system } = buildMessages(
			'薬',
			'extract-vocabulary',
			['Meaning'],
			{
				instruction: '  \n ',
			},
		);

		expect(
			system.startsWith(defaultInstruction('extract-vocabulary')),
		).toBe(true);
	});
});

describe('buildMessages — build-image-prompt instruction', () => {
	const { system } = buildMessages('Word: 薬', 'build-image-prompt', []);

	it('asks for one short English line ending in the shared style', () => {
		expect(system).toContain('English, one line, 20-50 words');
		expect(system).toContain(`end with exactly: ${IMAGE_STYLE}`);
		expect(system).toContain('keys are exactly: ["idea","prompt"]');
	});

	it('plans the picture: first sense, then a strategy per kind of word', () => {
		expect(system).toContain('The first line is the item to learn');
		expect(system).toContain(
			'the first sense in the definition/meaning field',
		);
		expect(system).toContain('Example-sentence fields only help');
		for (const kind of [
			'Thing',
			'Action',
			'Quality',
			'Feeling',
			'Abstract idea',
		])
			expect(system).toContain(`\n- ${kind} →`);
	});

	it('illustrates a spoken phrase as the moment it is said, without speech bubbles', () => {
		expect(system).toContain('\n- Spoken phrase (greeting');
		expect(system).toContain('the listener reacting');
		expect(system).toContain('signs or speech bubbles');
	});

	// A card like "Term — thuật ngữ; thời hạn" with Ex "契約期間は一年です" once produced
	// "calendar page showing one year marked with a highlighted box".
	it('steers away from writing objects and diagram marks', () => {
		expect(system).toMatch(/mostly writing or numbers \(calendars/);
		expect(system).toMatch(/diagram marks \(arrows, boxes, highlights/);
	});

	it('includes worked examples as valid JSON ending in the shared style', () => {
		const lines = system.split('\n');
		const examples = lines
			.slice(lines.indexOf('Examples:') + 1)
			.filter((l) => l.startsWith('{'));
		expect(examples).toHaveLength(5);
		for (const line of examples) {
			const ex = JSON.parse(line) as { idea: string; prompt: string };
			expect(ex.idea).not.toBe('');
			expect(ex.prompt.endsWith(`, ${IMAGE_STYLE}`)).toBe(true);
		}
	});

	// SD-style models draw whatever is named, even negated — "no text" yields text.
	it('never suggests writing "no text" into the prompt', () => {
		expect(system.toLowerCase()).not.toContain('no text');
		expect(system).not.toContain('must not ask for text');
	});
});
