# Changelog

All notable changes to this project are documented in this file.

## [1.0.0]

### Added

- AnkiConnect client wrapper: base request function, note CRUD actions, and metadata
  actions (deck/model/field name lookups).
- Note content parser: frontmatter reader/writer and heading-based content section
  parsing.
- Dynamic field mapping (pass 1: exact name match) — no hardcoded field names.
- `syncNote` core flow: create-or-update a note in Anki from the active file, with
  recovery from a stale `anki_note_id` and explicit error handling for offline
  AnkiConnect, duplicate notes, parse errors, and missing models.
- `anki-controls` code block processor rendering the Sync button with conditional
  visibility, wired to the sync flow.
- Toast helper wrapping Obsidian's `Notice`, with per-action copy and duration.
- Settings Tab connection flow: AnkiConnect URL input (with default-when-blank),
  Connect button, and Deck/Model dropdowns whose selection persists to settings.

### Fixed

- `sanitizeForFilename` now handles Windows reserved names and surrogate pairs.
- `anki_note_id` is read via `metadataCache` instead of `ctx.frontmatter`.
- Sync failures surface the underlying `SyncError` message instead of a generic toast.

[1.0.0]: https://github.com/stoic031/anki-bridge/releases/tag/1.0.0
