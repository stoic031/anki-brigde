import { describe, expect, it } from 'vitest';
import { isValidMediaPrefix, isValidUrl } from './validation';

describe('isValidUrl', () => {
	it('accepts a well-formed URL', () => {
		expect(isValidUrl('http://localhost:8765')).toBe(true);
	});

	it('rejects an unparseable string', () => {
		expect(isValidUrl('not a url')).toBe(false);
	});
});

describe('isValidMediaPrefix', () => {
	it('accepts the default prefix', () => {
		expect(isValidMediaPrefix('_obsidian_')).toBe(true);
	});

	it('accepts unicode', () => {
		expect(isValidMediaPrefix('診察_')).toBe(true);
	});

	it('rejects an empty string', () => {
		expect(isValidMediaPrefix('')).toBe(false);
	});

	it('rejects a whitespace-only string', () => {
		expect(isValidMediaPrefix('   ')).toBe(false);
	});

	it('rejects a path separator', () => {
		expect(isValidMediaPrefix('a/b')).toBe(false);
	});

	it('rejects Anki-hostile characters', () => {
		expect(isValidMediaPrefix('bad*prefix')).toBe(false);
	});
});
