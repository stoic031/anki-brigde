import { describe, expect, it } from 'vitest';
import { buildMessages, resultKeys, IMAGE_PROMPT_KEY } from './prompt';

describe('resultKeys', () => {
	it('is targetFields for a normal task', () => {
		expect(
			resultKeys('extract-vocabulary', ['Meaning', 'Furigana']),
		).toEqual(['Meaning', 'Furigana']);
	});

	it('is always [prompt] for build-image-prompt, ignoring targetFields', () => {
		expect(resultKeys('build-image-prompt', ['Meaning'])).toEqual([
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
