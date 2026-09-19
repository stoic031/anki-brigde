// docs/design/06-settings.md §6.1 — used as the AnkiConnect URL until Settings Tab
// (Task #75) adds a configurable value.
export const DEFAULT_ANKI_CONNECT_URL = 'http://localhost:8765';

// docs/design/03-note.md §3.1 — kept here (not in controlsBlock.ts) so modules that only
// need the block language, like contentTemplate.ts, don't have to import 'obsidian'.
export const CONTROLS_BLOCK_LANGUAGE = 'anki-controls';

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
