import { describe, expect, it } from 'vitest';
import type { SectionValue } from '../types';
import { mapContentToFields } from './fieldMapper';

function sections(
	entries: [string, SectionValue][],
): Map<string, SectionValue> {
	return new Map(entries);
}

describe('mapContentToFields — Pass 1 exact match', () => {
	it('matches a section case-insensitively', () => {
		const result = mapContentToFields(
			sections([['front', '診察']]),
			['Front'],
			'Basic',
		);
		expect(result.fields.Front).toBe('診察');
	});

	it('trims whitespace from the field name before matching', () => {
		const result = mapContentToFields(
			sections([['front', '診察']]),
			[' Front '],
			'Basic',
		);
		expect(result.fields[' Front ']).toBe('診察');
	});

	it('leaves a field with no matching section unmapped by this pass', () => {
		// A second, matching field keeps Pass 3 (which needs *nothing* mapped at all) from firing.
		const result = mapContentToFields(
			sections([['back', 'Khám bệnh']]),
			['Back', 'Front'],
			'Basic',
		);
		expect(result.fields.Front).toBe('');
	});

	it('only lets the first of two fields that normalize to the same key claim the section', () => {
		const result = mapContentToFields(
			sections([['front', '診察']]),
			['Front', 'front'],
			'Basic',
		);
		expect(result.fields.Front).toBe('診察');
		expect(result.fields.front).toBe('');
	});
});

describe('mapContentToFields — Pass 2 alias match', () => {
	it('maps a field via alias when no exact match exists', () => {
		const result = mapContentToFields(
			sections([['word', '診察']]),
			['Front'],
			'Basic',
		);
		expect(result.fields.Front).toBe('診察');
	});

	it('prefers the first alias in FIELD_ALIASES order when multiple aliased sections exist', () => {
		const result = mapContentToFields(
			sections([
				['term', 'second choice'],
				['word', 'first choice'],
			]),
			['Front'],
			'Basic',
		);
		expect(result.fields.Front).toBe('first choice');
	});

	it('skips an alias section already claimed by Pass 1 for another field', () => {
		const result = mapContentToFields(
			sections([
				['word', '診察'],
				['term', 'fallback term'],
			]),
			['word', 'Front'],
			'Basic',
		);
		expect(result.fields.word).toBe('診察');
		expect(result.fields.Front).toBe('fallback term');
	});

	it('leaves a field with no FIELD_ALIASES entry unmapped by this pass', () => {
		// A second, matching field keeps Pass 3 (which needs *nothing* mapped at all) from firing.
		const result = mapContentToFields(
			sections([
				['front', '診察'],
				['unrelated', 'value'],
			]),
			['Front', 'Notes'],
			'Basic',
		);
		expect(result.fields.Notes).toBe('');
	});

	it('applies alias lookup case-insensitively on the field name', () => {
		const result = mapContentToFields(
			sections([['word', '診察']]),
			['FRONT'],
			'Basic',
		);
		expect(result.fields.FRONT).toBe('診察');
	});
});

describe('mapContentToFields — Pass 3 positional fallback', () => {
	it('assigns sections to fields positionally, in map order, when nothing else matched', () => {
		const result = mapContentToFields(
			sections([
				['unrelated1', 'first'],
				['unrelated2', 'second'],
			]),
			['FieldA', 'FieldB'],
			'Basic',
		);
		expect(result.fields.FieldA).toBe('first');
		expect(result.fields.FieldB).toBe('second');
	});

	it('emits the exact fallback warning when it fires', () => {
		const result = mapContentToFields(
			sections([['unrelated', 'value']]),
			['FieldA'],
			'Basic',
		);
		expect(result.warnings).toContain(
			'Pass 1 and 2 mapped no fields; used positional fallback.',
		);
	});

	it('does not fire if Pass 1/2 mapped at least one field elsewhere', () => {
		const result = mapContentToFields(
			sections([
				['front', '診察'],
				['unrelated', 'should not be used positionally'],
			]),
			['Front', 'Notes'],
			'Basic',
		);
		expect(result.fields.Front).toBe('診察');
		expect(result.fields.Notes).toBe('');
		expect(result.warnings).not.toContain(
			'Pass 1 and 2 mapped no fields; used positional fallback.',
		);
	});

	it('defaults extra fields to empty string when there are more fields than sections', () => {
		const result = mapContentToFields(
			sections([['unrelated', 'only one']]),
			['FieldA', 'FieldB'],
			'Basic',
		);
		expect(result.fields.FieldA).toBe('only one');
		expect(result.fields.FieldB).toBe('');
	});

	it('leaves extra sections unmapped when there are more sections than fields', () => {
		const result = mapContentToFields(
			sections([
				['unrelated1', 'first'],
				['unrelated2', 'second'],
			]),
			['FieldA'],
			'Basic',
		);
		expect(result.fields.FieldA).toBe('first');
		expect(result.warnings.some((w) => w.includes('unrelated2'))).toBe(
			true,
		);
	});
});

describe('mapContentToFields — afterwards: defaults and warnings', () => {
	it('defaults an unmapped field to empty string while keeping the key present', () => {
		const result = mapContentToFields(
			sections([['front', '診察']]),
			['Front', 'Notes'],
			'Basic',
		);
		expect(result.fields.Notes).toBe('');
		expect('Notes' in result.fields).toBe(true);
	});

	it('emits a singular warning for exactly one unmapped section', () => {
		const result = mapContentToFields(
			sections([
				['front', '診察'],
				['collocations', ['診察を受ける']],
			]),
			['Front'],
			'Basic',
		);
		expect(result.warnings).toEqual([
			"1 section not mapped to model 'Basic': collocations",
		]);
	});

	it('emits a pluralized warning listing normalized (lowercased) keys for multiple unmapped sections', () => {
		const result = mapContentToFields(
			sections([
				['front', '診察'],
				['collocations', ['a']],
				['part of speech', 'noun'],
			]),
			['Front'],
			'Basic',
		);
		expect(result.warnings).toEqual([
			"2 sections not mapped to model 'Basic': collocations, part of speech",
		]);
	});

	it('emits both the fallback warning and the unmapped-section warning, in that order, when both apply', () => {
		const result = mapContentToFields(
			sections([
				['unrelated1', 'first'],
				['unrelated2', 'second'],
			]),
			['FieldA'],
			'Basic',
		);
		expect(result.warnings).toEqual([
			'Pass 1 and 2 mapped no fields; used positional fallback.',
			"1 section not mapped to model 'Basic': unrelated2",
		]);
	});

	it('joins a list section with newlines when it is mapped into a field', () => {
		const result = mapContentToFields(
			sections([['collocations', ['診察を受ける', '診察室']]]),
			['Collocations'],
			'Basic',
		);
		expect(result.fields.Collocations).toBe('診察を受ける\n診察室');
	});

	it('passes a plain string section through unchanged when mapped into a field', () => {
		const result = mapContentToFields(
			sections([['front', '診察']]),
			['Front'],
			'Basic',
		);
		expect(result.fields.Front).toBe('診察');
	});
});

describe('mapContentToFields — edge cases', () => {
	it('defaults every field to empty string when there are no sections at all', () => {
		const result = mapContentToFields(
			sections([]),
			['Front', 'Back'],
			'Basic',
		);
		expect(result.fields).toEqual({ Front: '', Back: '' });
		expect(result.warnings).toEqual([
			'Pass 1 and 2 mapped no fields; used positional fallback.',
		]);
	});

	it('returns an empty fields object for an empty fields list, still firing the fallback warning', () => {
		const result = mapContentToFields(
			sections([['front', '診察']]),
			[],
			'Basic',
		);
		expect(result.fields).toEqual({});
		expect(result.warnings).toEqual([
			'Pass 1 and 2 mapped no fields; used positional fallback.',
			"1 section not mapped to model 'Basic': front",
		]);
	});
});

describe('mapContentToFields — end to end', () => {
	it('maps a realistic vocabulary note via a mix of exact and alias matches', () => {
		const result = mapContentToFields(
			sections([
				['word', '診察'],
				['meaning', 'Khám bệnh'],
				['example', '診察を受けました。'],
				['reading', 'しんさつ'],
				['collocations', ['診察を受ける', '診察室']],
			]),
			['Front', 'Back', 'Example', 'Furigana', 'Notes'],
			'Vocab',
		);

		expect(result.fields).toEqual({
			Front: '診察',
			Back: 'Khám bệnh',
			Example: '診察を受けました。',
			Furigana: 'しんさつ',
			Notes: '',
		});
		expect(result.warnings).toEqual([
			"1 section not mapped to model 'Vocab': collocations",
		]);
	});
});

describe('mapContentToFields — sources', () => {
	it('records which section filled each field, across all passes', () => {
		const exactAndAlias = mapContentToFields(
			sections([
				['word', '診察'],
				['back', 'exam'],
			]),
			['Front', 'Back', 'Extra'],
			'Basic',
		);
		expect(exactAndAlias.sources).toEqual({ Front: 'word', Back: 'back' });

		const positional = mapContentToFields(
			sections([['unrelated', 'v']]),
			['FieldA'],
			'Basic',
		);
		expect(positional.sources).toEqual({ FieldA: 'unrelated' });
	});
});
