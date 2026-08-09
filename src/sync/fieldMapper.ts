import type { SectionValue } from '../types';

export function mapContentToFields(sections: Map<string, SectionValue>, fields: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	const usedSections = new Set<string>();

	// Pass 1 — exact name match (case-insensitive), docs/contracts.md §3
	for (const field of fields) {
		const key = field.trim().toLowerCase();
		if (usedSections.has(key)) continue;
		const value = sections.get(key);
		if (value === undefined) continue;
		result[field] = stringifySectionValue(value);
		usedSections.add(key);
	}

	return result;
}

function stringifySectionValue(value: SectionValue): string {
	return Array.isArray(value) ? value.join('\n') : value;
}
