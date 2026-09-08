// docs/design/06-settings.md §6.1 — used as the AnkiConnect URL until Settings Tab
// (Task #75) adds a configurable value.
export const DEFAULT_ANKI_CONNECT_URL = 'http://localhost:8765';

// docs/contracts.md §3 — Pass 2 alias table. Add aliases here only; fieldMapper.ts
// doesn't need to change.
export const FIELD_ALIASES: Record<string, string[]> = {
	front: ['word', 'term', 'expression'],
	back: ['meaning', 'definition', 'translation'],
	audio: ['sound', 'pronunciation'],
	image: ['picture', 'illustration'],
	furigana: ['reading', 'kana'],
	example: ['sentence', 'usage'],
};
