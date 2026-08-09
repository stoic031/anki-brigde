import { describe, expect, it } from 'vitest';
import { sanitizeForFilename } from './mediaNaming';

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
