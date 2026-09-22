import { describe, expect, it } from 'vitest';
import { applyImageTag } from './applyImageTag';

const tag = '<img src="new.png">';

describe('applyImageTag', () => {
	it('append: fills an empty section with the new tag', () => {
		const r = applyImageTag('## Word\n薬\n\n## Image\n\n', 'Image', tag, 'append');

		expect(r).toBe('## Word\n薬\n\n## Image\n\n<img src="new.png">');
	});

	it('append: keeps the existing tag and adds the new one after it', () => {
		const content = '## Image\n<img src="old.png">\n\n## Notes\nx\n';
		const r = applyImageTag(content, 'Image', tag, 'append');

		expect(r).toBe(
			'## Image\n<img src="old.png">\n\n<img src="new.png">\n## Notes\nx\n',
		);
	});

	it('overwrite: removes the existing tag(s) but keeps other text in the section', () => {
		const content =
			'## Image\n<img src="old.png">\nsome note the user wrote\n\n## Notes\nx\n';
		const r = applyImageTag(content, 'Image', tag, 'overwrite');

		expect(r).toBe(
			'## Image\nsome note the user wrote\n\n<img src="new.png">\n## Notes\nx\n',
		);
	});

	it('overwrite: removes multiple existing tags', () => {
		const content = '## Image\n<img src="a.png">\n<img src="b.png">\n';
		const r = applyImageTag(content, 'Image', tag, 'overwrite');

		expect(r).toBe('## Image\n\n<img src="new.png">');
	});

	it('overwrite on an empty section behaves like append', () => {
		const r = applyImageTag('## Image\n\n', 'Image', tag, 'overwrite');

		expect(r).toBe('## Image\n\n<img src="new.png">');
	});

	it('appends a missing section at the end of the note', () => {
		const r = applyImageTag('## Word\n薬', 'Image', tag, 'append');

		expect(r).toBe('## Word\n薬\n\n## Image\n\n<img src="new.png">\n');
	});

	it('matches the field case-insensitively', () => {
		const r = applyImageTag('## IMAGE\n\n', 'Image', tag, 'append');

		expect(r).toBe('## IMAGE\n\n<img src="new.png">');
	});

	it('reuses an alias section instead of adding a duplicate', () => {
		// "Image" is aliased to "picture"/"illustration" (FIELD_ALIASES) — the reverse
		// (alias key -> canonical field) is what resolveSectionKey looks up here.
		const r = applyImageTag('## Picture\n\n', 'Image', tag, 'append');

		expect(r).toBe('## Picture\n\n<img src="new.png">');
		expect(r).not.toContain('## Image');
	});

	it('preserves CRLF line endings', () => {
		const r = applyImageTag('## Image\r\n\r\n', 'Image', tag, 'append');

		expect(r).toBe('## Image\r\n\r\n<img src="new.png">');
		expect(r.replace(/\r\n/g, '')).not.toContain('\n');
	});
});
