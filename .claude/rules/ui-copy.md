---
paths:
    - 'src/ui/**/*.ts'
    - 'src/note/controlsBlock.ts'
    - 'styles.css'
---

# UI, copy, and feedback

Spec: `docs/design.md` Modules 3, 5, 6, 7.

## Copy

- **All user-facing strings in English.** This plugin targets the Obsidian community
  store. If the spec quotes a string in another language, translate it and keep it
  consistent with the surrounding copy.
- Sentence case: "Add audio", not "Add Audio".
- Bold for literal UI labels; arrow notation for navigation: **Settings → Community plugins**.
- Reuse the existing emoji set (🔄 sync, 🗑️ delete, 🔊 audio, 🖼️ image, ⏳ working,
  ✅ success, ❌ error). Don't invent new icons per feature.
- Failure copy says what happened **and what to do next**: "❌ Failed to sync. Please
  check Anki connection." — never a bare error code.

## Button states

Every action button cycles: normal → `⏳ …` (disabled, opacity 0.6, `cursor: not-allowed`)
→ `✅ Done!` (~2s) or `❌ Error` (~3s) → back to normal, or hidden if the action is no
longer applicable.

Visibility is conditional per design.md Module 3.2 — e.g. Delete only renders when
`anki_note_id` exists, Add Audio only when the content has no `[sound:...]`.

## Long operations

AI calls take 5–30s. Show a persistent `Notice` that updates as work progresses, then
replace it with a success toast. A static "Processing..." with no updates is a bug.

## Styling

Use Obsidian CSS variables (`--background-secondary`, `--text-accent`,
`--background-modifier-border`, …) — never hardcoded hex. The plugin must look correct
in both light and dark themes and in any community theme.

Prefix all CSS classes to avoid collisions with other plugins.

## State

Settings tab and sidebar view read and write the **same** `this.settings` object and
both re-render on change. Two copies of deck/model state that drift apart is the single
most likely bug in this area.

## Cleanup

Every listener registered from a view or modal uses `this.registerDomEvent` /
`this.registerEvent` / `this.registerInterval`, or is torn down in `onClose`. Detached
listeners survive plugin reload and cause duplicate handlers.
