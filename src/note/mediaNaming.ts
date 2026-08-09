// Windows reserves these basenames (case-insensitive, extension doesn't save you) —
// matters because this function also names notes (sanitizeForFilename(text) + '.md',
// see docs/design/03-note.md §3.7), not just media files.
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeForFilename(word: string): string {
	const sanitized =
		word
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
