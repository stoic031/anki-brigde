import { describe, expect, it } from 'vitest';
import { generateContentSkeleton, rebuildContent } from './contentTemplate';
import { parseSections } from '../sync/parser';

describe('generateContentSkeleton', () => {
	it('matches the docs/design/03-note.md §3.6 2-field example (Basic (and reversed card))', () => {
		expect(generateContentSkeleton(['Front', 'Back'])).toBe(
			'## Front\n\n## Back\n',
		);
	});

	it('matches the docs/design/03-note.md §3.6 5-field example (Japanese Vocabulary)', () => {
		expect(
			generateContentSkeleton([
				'Word',
				'Meaning',
				'Furigana',
				'Audio',
				'Image',
			]),
		).toBe(
			'## Word\n\n## Meaning\n\n## Furigana\n\n## Audio\n\n## Image\n',
		);
	});

	it('preserves field order as given, without sorting', () => {
		const result = generateContentSkeleton(['Zebra', 'Apple']);
		expect(result.match(/^## .+$/gm)).toEqual(['## Zebra', '## Apple']);
	});

	it('leaves every section empty — a heading followed only by a blank line', () => {
		expect(generateContentSkeleton(['Front'])).toBe('## Front\n');
	});

	it('is empty when there are no fields', () => {
		expect(generateContentSkeleton([])).toBe('');
	});

	it('pre-fills only the first field section when firstFieldContent is given', () => {
		expect(generateContentSkeleton(['Word', 'Meaning'], '薬')).toBe(
			'## Word\n\n薬\n\n## Meaning\n',
		);
	});

	it('ignores firstFieldContent when there are no fields', () => {
		expect(generateContentSkeleton([], '薬')).toBe('');
	});

	it('round-trips through parseSections: every field becomes its own empty section', () => {
		const fields = ['Word', 'Meaning', 'Furigana'];
		const sections = parseSections(generateContentSkeleton(fields));

		expect(sections.size).toBe(fields.length);
		for (const field of fields) {
			expect(sections.get(field.toLowerCase())).toBe('');
		}
	});

	it('round-trips a pre-filled first field, including multi-line selected text', () => {
		const fields = ['Word', 'Meaning'];
		const selectedText = '薬\nくすり (medicine)';
		const sections = parseSections(
			generateContentSkeleton(fields, selectedText),
		);

		expect(sections.get('word')).toBe(selectedText);
		expect(sections.get('meaning')).toBe('');
	});
});

describe('rebuildContent', () => {
	const skeleton = '## Front\n\n## Back\n';

	it('keeps the frontmatter and replaces everything after it', () => {
		const content =
			'---\nanki_deck: Japanese\nanki_note_id: 5\n---\n\n## Word\n\nold text\n';

		expect(rebuildContent(content, ['Front', 'Back'])).toBe(
			`---\nanki_deck: Japanese\nanki_note_id: 5\n---\n\n${skeleton}`,
		);
	});

	it('drops a legacy anki-controls block along with the rest of the old body', () => {
		const content =
			'---\na: 1\n---\n\n```anki-controls\n```\n\n## Word\n\nold\n';

		expect(rebuildContent(content, ['Front', 'Back'])).toBe(
			`---\na: 1\n---\n\n${skeleton}`,
		);
	});

	it('handles frontmatter with no trailing newline', () => {
		expect(
			rebuildContent('---\nanki_deck: X\n---', ['Front', 'Back']),
		).toBe(`---\nanki_deck: X\n---\n\n${skeleton}`);
	});

	it('returns just the skeleton when there is no frontmatter', () => {
		expect(rebuildContent('some text', ['Front', 'Back'])).toBe(skeleton);
	});

	it('does not mistake a later --- rule for frontmatter', () => {
		expect(rebuildContent('intro\n---\nmore', ['Front', 'Back'])).toBe(
			skeleton,
		);
	});

	it('is stable when applied twice (idempotent)', () => {
		const once = rebuildContent('---\na: 1\n---\n\nbody', [
			'Front',
			'Back',
		]);

		expect(rebuildContent(once, ['Front', 'Back'])).toBe(once);
	});
});
