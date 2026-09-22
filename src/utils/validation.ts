// AGENTS.md — "Settings validation before save: ... URLs parse."
export function isValidUrl(value: string): boolean {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
}

// AGENTS.md — "media prefix has no path/special chars". Same denylist as
// sanitizeForFilename (mediaNaming.ts) — control chars, path separators, and
// Anki-hostile characters — but rejects rather than strips, and empty is never valid
// (docs/contracts.md §5: the prefix is never empty).
export function isValidMediaPrefix(value: string): boolean {
	if (value.trim() === '') return false;
	// eslint-disable-next-line no-control-regex -- intentional, mirrors sanitizeForFilename
	return !/[\u0000-\u001f\u007f\\/:*?"<>|[\]]/.test(value);
}
