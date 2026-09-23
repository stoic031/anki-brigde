// docs/design/06-settings.md §6.1 — used as the AnkiConnect URL until Settings Tab
// (Task #75) adds a configurable value.
export const DEFAULT_ANKI_CONNECT_URL = 'http://localhost:8765';

// docs/design/06-settings.md §6.4 / docs/contracts.md §5 — default media filename prefix.
export const DEFAULT_MEDIA_PREFIX = '_obsidian_';

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

// Fired on app.workspace when the active profile changes, so the Settings tab and
// sidebar can re-render their profile selector. docs/design/07-sidebar.md §7.4.
export const PROFILE_CHANGED_EVENT = 'anki-bridge:profile-changed';

// docs/design/06-settings.md §6.1/§6.2 — fixed list for Learning language / Your
// language (both selects, not free text). Labels are in English regardless of the
// language itself, e.g. "Vietnamese" not "Tiếng Việt".
export const LANGUAGES = [
	'English',
	'Chinese',
	'Japanese',
	'Korean',
	'German',
	'Spanish',
	'Vietnamese',
];
