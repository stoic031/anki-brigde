import { describe, expect, it } from 'vitest';
import { generateContentSkeleton } from './contentTemplate';
import { parseSections } from '../sync/parser';

describe('generateContentSkeleton', () => {
	it('matches the docs/design/03-note.md §3.6 2-field example (Basic (and reversed card))', () => {
		expect(generateContentSkeleton(['Front', 'Back'])).toBe(
			'```anki-controls\n```\n\n## Front\n\n## Back\n',
		);
	});

	it('matches the docs/design/03-note.md §3.6 5-field example (Japanese Vocabulary)', () => {
		expect(generateContentSkeleton(['Word', 'Meaning', 'Furigana', 'Audio', 'Image'])).toBe(
			'```anki-controls\n```\n\n## Word\n\n## Meaning\n\n## Furigana\n\n## Audio\n\n## Image\n',
		);
	});

	it('preserves field order as given, without sorting', () => {
		const result = generateContentSkeleton(['Zebra', 'Apple']);
		expect(result.match(/^## .+$/gm)).toEqual(['## Zebra', '## Apple']);
	});

	it('leaves every section empty — a heading followed only by a blank line', () => {
		expect(generateContentSkeleton(['Front'])).toBe('```anki-controls\n```\n\n## Front\n');
	});

	it('still emits the anki-controls block alone when there are no fields', () => {
		expect(generateContentSkeleton([])).toBe('```anki-controls\n```\n');
	});

	it('round-trips through parseSections: every field becomes its own empty section', () => {
		const fields = ['Word', 'Meaning', 'Furigana'];
		const sections = parseSections(generateContentSkeleton(fields));

		expect(sections.size).toBe(fields.length);
		for (const field of fields) {
			expect(sections.get(field.toLowerCase())).toBe('');
		}
	});
});
