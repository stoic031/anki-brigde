// Windows reserves these basenames (case-insensitive, extension doesn't save you) —
// matters because this function also names notes (sanitizeForFilename(text) + '.md',
// see docs/design/03-note.md §3.7), not just media files.
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeForFilename(word: string): string {
	const sanitized = word
		.normalize('NFC')
		// eslint-disable-next-line no-control-regex -- intentional: strips control characters per docs/contracts.md §5
		.replace(/[\u0000-\u001f\u007f]/g, '') // control characters
		.replace(/[\\/:*?"<>|[\]]/g, '') // path separators and Anki-hostile chars
		.replace(/\s+/g, '_')
		.replace(/^\.+/, ''); // no leading dots

	// Array.from splits on Unicode code points, not UTF-16 code units, so a 40-char
	// slice can't cut a surrogate pair (e.g. an astral character) in half.
	const truncated = Array.from(sanitized).slice(0, 40).join('') || 'note';

	return WINDOWS_RESERVED_NAME.test(truncated) ? `${truncated}_` : truncated;
}

// docs/design/03-note.md §3.5 — `{prefix}{word}_image_{timestamp}.{ext}`. The prefix is
// what stops Anki's "Check Media" from deleting plugin-generated files; it's user-
// configurable (docs/design/06-settings.md §6.4) — callers resolve it via
// resolveMediaPrefix(settings) and pass it in here. Audio was dropped, so `image` is the
// only media type this ever names — no type param needed.
export function buildMediaFilename(
	word: string,
	ext: string,
	prefix: string,
): string {
	const timestamp = Math.floor(Date.now() / 1000);
	return `${prefix}${sanitizeForFilename(word)}_image_${timestamp}.${ext}`;
}
