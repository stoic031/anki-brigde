import { describe, expect, it } from 'vitest';
import { isValidUrl } from './validation';

describe('isValidUrl', () => {
	it('accepts a well-formed URL', () => {
		expect(isValidUrl('http://localhost:8765')).toBe(true);
	});

	it('rejects an unparseable string', () => {
		expect(isValidUrl('not a url')).toBe(false);
	});
});
