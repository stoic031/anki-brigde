# Changelog

All notable changes to this project are documented in this file.

## [1.1.0]

### Added

- Sidebar view with a **Profile** selector, tabs, and controls for the active note:
  - **Note** tab: Deck and Model dropdowns that mirror and edit the note's `anki_deck` /
    `anki_model` properties (with a warning modal when the note is already synced), and a
    **Sync | Rebuild | Delete** button row. Delete appears as soon as the note has an
    `anki_note_id`. Rebuild replaces the note content with one empty `## Field` section
    per field of its Model, after a confirmation.
  - **Text** tab: "Fields to generate with AI" checkboxes, saved per Deck + Model pair,
    with a Generate button.
- Profiles (Deck + Model + "Save notes to" folder), managed in Settings and selectable in
  both Settings and the sidebar; new notes use the active profile.
- Commands: **Create new note**, **Create note from selection** (no default hotkey), and
  **Open Deck & Model Selector**. New notes get one `## Field` section per Model field.
- Field mapping passes 2 (alias table) and 3 (positional fallback), with aggregated
  warnings for sections that could not be mapped.
- Settings: Deck and Model pickers are always shown and load Anki's names when the tab
  opens; the "Save notes to" folder picker lists real vault folders as a tree.
- Shared pre-check for the AI buttons.

### Changed

- The note controls moved from the in-note `anki-controls` code block to the sidebar.
  Sync and Delete now use the AnkiConnect URL from Settings.
- Deck/Model for new notes come from the active profile instead of separate "default" and
  "current" values. Existing settings are migrated to a "Default" profile on load.
- Changing Deck/Model on an already-synced note asks for confirmation; "Update" rewrites
  the property and clears `anki_note_id` so the next sync creates a new Anki note.

### Removed

- The `anki-controls` code block. Notes that still contain it keep syncing normally; it
  shows as a plain code block, and **Rebuild** removes it.
- The Connection Status row, refresh button, and "Save notes to" folder select in the
  sidebar.

### Fixed

- Nested "Save notes to" folders display and sort correctly in both Settings and the
  sidebar.
- "Generate with AI" field checkboxes recover after AnkiConnect reconnects.

### Notes

- **Generate** currently only runs its pre-check; AI generation is not implemented yet.
  The Audio and Image tabs are planned and not part of this release.

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

[1.1.0]: https://github.com/stoic031/anki-brigde/releases/tag/1.1.0
[1.0.0]: https://github.com/stoic031/anki-bridge/releases/tag/1.0.0
