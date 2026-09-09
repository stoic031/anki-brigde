import type { FieldMappingResult, SectionValue } from '../types';
import { FIELD_ALIASES } from '../utils/constants';

export function mapContentToFields(sections: Map<string, SectionValue>, fields: string[]): FieldMappingResult {
	const result: Record<string, string> = {};
	const usedSections = new Set<string>();
	const warnings: string[] = [];

	// Pass 1 — exact name match (case-insensitive), docs/contracts.md §3
	for (const field of fields) {
		const key = field.trim().toLowerCase();
		if (usedSections.has(key)) continue;
		const value = sections.get(key);
		if (value === undefined) continue;
		result[field] = stringifySectionValue(value);
		usedSections.add(key);
	}

	// Pass 2 — alias match, docs/contracts.md §3
	for (const field of fields) {
		if (result[field] !== undefined) continue;
		const key = field.trim().toLowerCase();
		const aliases = FIELD_ALIASES[key];
		if (!aliases) continue;
		for (const alias of aliases) {
			if (usedSections.has(alias)) continue;
			const value = sections.get(alias);
			if (value === undefined) continue;
			result[field] = stringifySectionValue(value);
			usedSections.add(alias);
			break;
		}
	}

	// Pass 3 — positional fallback, docs/contracts.md §3. Only runs if Pass 1+2 mapped nothing.
	if (Object.keys(result).length === 0) {
		const sectionIter = sections.entries();
		for (const field of fields) {
			const next = sectionIter.next();
			if (next.done) break;
			const [sectionKey, value] = next.value;
			result[field] = stringifySectionValue(value);
			usedSections.add(sectionKey);
		}
		warnings.push('Pass 1 and 2 mapped no fields; used positional fallback.');
	}

	return { fields: result, warnings };
}

function stringifySectionValue(value: SectionValue): string {
	return Array.isArray(value) ? value.join('\n') : value;
}
