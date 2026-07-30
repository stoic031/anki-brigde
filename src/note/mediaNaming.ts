export function sanitizeForFilename(word: string): string {
	return (
		word
			.normalize('NFC')
			// eslint-disable-next-line no-control-regex -- intentional: strips control characters per docs/contracts.md §5
			.replace(/[\u0000-\u001f\u007f]/g, '') // control characters
			.replace(/[\\/:*?"<>|[\]]/g, '') // path separators and Anki-hostile chars
			.replace(/\s+/g, '_')
			.replace(/^\.+/, '') // no leading dots
			.slice(0, 40) || 'note'
	);
}
