import { describe, expect, it } from 'vitest';
import { fillEmptySections, resolveSectionKey } from './fillEmptySections';

const skeleton =
	'---\nanki_deck: D\n---\n## Word\n薬\n\n## Meaning\n\n## Furigana\n\n';

describe('fillEmptySections', () => {
	it('fills an empty section and leaves everything else untouched', () => {
		const r = fillEmptySections(skeleton, { Meaning: 'medicine' });

		expect(r.content).toBe(
			'---\nanki_deck: D\n---\n## Word\n薬\n\n## Meaning\n\nmedicine\n\n## Furigana\n\n',
		);
		expect(r.filled).toEqual(['Meaning']);
		expect(r.skipped).toEqual([]);
	});

	it('never overwrites a section that already has content', () => {
		const content = '## Word\n薬\n\n## Meaning\nmine\n';
		const r = fillEmptySections(content, { Meaning: 'model wrote this' });

		expect(r.content).toBe(content);
		expect(r.skipped).toEqual(['Meaning']);
		expect(r.filled).toEqual([]);
	});

	it('matches headings case-insensitively and ignores blank result values', () => {
		const r = fillEmptySections('## MEANING\n\n## Furigana\n', {
			meaning: 'x',
			Furigana: '   ',
		});

		expect(r.filled).toEqual(['meaning']);
		expect(r.content).toContain('## MEANING\n\nx\n');
		expect(r.content).toContain('## Furigana\n');
	});

	it('appends a missing section at the end', () => {
		const r = fillEmptySections('## Word\n薬', { Meaning: 'medicine' });

		expect(r.content).toBe('## Word\n薬\n\n## Meaning\n\nmedicine\n');
		expect(r.filled).toEqual(['Meaning']);
	});

	it('reuses an alias section instead of adding a duplicate', () => {
		// Field "Back" is aliased to "meaning" (FIELD_ALIASES).
		const r = fillEmptySections('## Front\nx\n\n## Meaning\n\n', {
			Back: 'y',
		});

		expect(r.content).toBe('## Front\nx\n\n## Meaning\n\ny\n\n');
		expect(r.content).not.toContain('## Back');
	});

	it('treats the last empty section at end of file correctly', () => {
		const r = fillEmptySections('## Word\nx\n\n## Meaning\n', {
			Meaning: 'm',
		});

		expect(r.content).toBe('## Word\nx\n\n## Meaning\n\nm\n');
	});

	it('does not treat a ### subheading as the end of a section', () => {
		const content = '## Meaning\n### Note\nhas content\n';
		const r = fillEmptySections(content, { Meaning: 'x' });

		expect(r.skipped).toEqual(['Meaning']);
		expect(r.content).toBe(content);
	});

	it('preserves CRLF line endings', () => {
		const r = fillEmptySections('## Word\r\nx\r\n\r\n## Meaning\r\n\r\n', {
			Meaning: 'm',
		});

		expect(r.content).toBe(
			'## Word\r\nx\r\n\r\n## Meaning\r\n\r\nm\r\n\r\n',
		);
		expect(r.content.replace(/\r\n/g, '')).not.toContain('\n');
	});
});

describe('resolveSectionKey', () => {
	it('prefers the exact name over an alias', () => {
		expect(resolveSectionKey(['word', 'front'], 'Front')).toBe('front');
	});
	it('falls back to an alias and returns undefined when nothing matches', () => {
		expect(resolveSectionKey(['word'], 'Front')).toBe('word');
		expect(resolveSectionKey(['other'], 'Front')).toBeUndefined();
	});
});
