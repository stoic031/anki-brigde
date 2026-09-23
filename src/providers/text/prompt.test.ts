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
});
