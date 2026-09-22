import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMediaFilename, sanitizeForFilename } from './mediaNaming';

describe('sanitizeForFilename', () => {
	it('preserves unicode', () => {
		expect(sanitizeForFilename('診察')).toBe('診察');
	});

	it('replaces whitespace with underscores', () => {
		expect(sanitizeForFilename('look up')).toBe('look_up');
	});

	it('strips path separators', () => {
		expect(sanitizeForFilename('a/b')).toBe('ab');
	});

	it('strips square brackets', () => {
		expect(sanitizeForFilename('[test]')).toBe('test');
	});

	it('falls back to "note" when nothing survives sanitization', () => {
		expect(sanitizeForFilename('...')).toBe('note');
	});

	it('falls back to "note" for empty input', () => {
		expect(sanitizeForFilename('')).toBe('note');
	});

	it('truncates to 40 characters', () => {
		expect(sanitizeForFilename('a'.repeat(200))).toBe('a'.repeat(40));
	});

	it('appends an underscore to Windows-reserved device names', () => {
		expect(sanitizeForFilename('con')).toBe('con_');
		expect(sanitizeForFilename('COM1')).toBe('COM1_');
	});

	it('does not split a surrogate pair when truncating to 40 characters', () => {
		const input = 'a'.repeat(39) + '😀';
		expect(sanitizeForFilename(input)).toBe(input);
	});
});

describe('buildMediaFilename', () => {
	beforeEach(() => {
		vi.useFakeTimers().setSystemTime(new Date('2023-10-31T12:30:33Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('matches docs/design/03-note.md §3.5: _obsidian_{word}_image_{timestamp}.{ext}', () => {
		expect(buildMediaFilename('apple', 'png')).toBe(
			'_obsidian_apple_image_1698755433.png',
		);
	});

	it('sanitizes the word the same way notes and media share', () => {
		expect(buildMediaFilename('look up', 'png')).toBe(
			'_obsidian_look_up_image_1698755433.png',
		);
	});

	it('falls back to "note" for an empty word', () => {
		expect(buildMediaFilename('', 'jpg')).toBe(
			'_obsidian_note_image_1698755433.jpg',
		);
	});
});
