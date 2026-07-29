# Open questions — design.md

Places where `design.md` is undefined or contradicts itself. An agent will hit these and
**pick an interpretation on its own** if they aren't answered first. Resolve in order.

Once a question is settled: edit `design.md` directly and delete the entry here.

---

## 🔴 Blocking Milestone 1

### 1. Can `%%anki-controls%%` actually render?

`%%...%%` is Obsidian's **comment syntax** — its contents are hidden at render time.
Catching that marker with `registerMarkdownPostProcessor` and swapping in buttons is
uncertain at best, and in Live Preview / Source mode it almost certainly won't fire.

The idiomatic Obsidian approach is a code block processor:

````markdown
```anki-controls

```
````

-> `this.registerMarkdownCodeBlockProcessor('anki-controls', (source, el, ctx) => {...})`

That API is documented and works reliably in both reading mode and Live Preview.

**Proposal:** switch to a code block. **Verify with a 20-line throwaway plugin before
building Module 3** — if the marker can't render, all of Module 3 needs redesigning.

### 2. Conflict resolution in a one-way sync

- §1.1 lists "Conflict Resolution: handle a note edited on both sides".
- §6.3 offers a dropdown: `obsidian_wins` / `anki_wins` / `prompt`.
- But the entire spec is **one-way, Obsidian → Anki**. Nothing ever reads content back
  from Anki.

What does `anki_wins` mean when the plugin never writes to Obsidian? Three options:

- **(a)** Drop the feature from Milestones 1–2 and state plainly: one-way sync,
  Anki-side edits get overwritten.
- **(b)** Call `notesInfo` before updating, diff the fields, prompt the user on a mismatch.
- **(c)** Defer to v2, alongside real two-way sync.

**Proposal: (a)** for v1 — least code, and it doesn't promise something the plugin
can't do.

### 3. What is `last_synced` for?

It appears in the frontmatter example in §1.2 and in no data flow anywhere. Either
define what it controls or remove it from the frontmatter.
**Proposal:** keep it, display-only (see `contracts.md` §1).

### 4. Do Audio/Image fields take a filename or the full tag?

§1.5 says "extract filename". But Anki needs `[sound:file.mp3]` inside the field to play
audio. See `contracts.md` §3. **Proposal:** write the full tag.

---

## 🟡 Blocking Milestones 2–3

### 5. The mapping algorithm has no precedence rule

§1.5 describes two mechanisms in parallel — name matching (`## Furigana` -> `Furigana`)
and positional matching (`## Word` -> "Front, or the first field") — without saying which
wins when both apply. See the proposed algorithm in `contracts.md` §3.

### 6. What happens to unmapped sections?

§1.5 says "skip or show a warning". That "or" is exactly where an agent will guess.
**Proposal:** always warn, batched into a single notice.

### 7. UI string language

§1.6 mixes languages: "Note already exists in Anki" sits next to a Vietnamese error
message. **Proposal:** all user-facing strings in English, since this targets the
Obsidian community store.

### 8. Button visibility with duplicate sections

"🔊 Add Audio only appears when there's no `[sound:...]`" — what if a note has two
`## Audio` sections, or has `[sound:x.mp3]` but the file was deleted from Anki's media
folder? Pick one simple rule: scan the whole content, hide the button if any `[sound:`
appears anywhere.

### 9. Where did Module 4 go?

Numbering jumps 3 -> 5. Either renumber, or add a line noting Module 4 was dropped, so
future readers don't go looking for it.

---

## 🟢 Worth doing, not blocking

### 10. No acceptance criteria per milestone

Each milestone currently has a one-line "Deliverable". Add a verifiable checklist —
for Milestone 1:

- [ ] Bad URL entered -> error shown, no crash
- [ ] Note without `anki_note_id` -> card created, ID written back to frontmatter
- [ ] Sync that same note again -> updated, **no** second card
- [ ] Anki quit mid-sync -> modal shown, frontmatter unchanged
- [ ] Card deleted in Anki, then re-synced -> new card created, stale ID replaced

### 11. Split `design.md` into multiple files

772 lines. An agent reads all of it to answer a question about one module. Split by module:

```
docs/design/
  README.md      # index + architecture overview
  01-sync.md     # Module 1
  02-providers.md
  03-note.md
  05-ui.md
  06-settings.md
  07-sidebar.md
  scenarios.md
  roadmap.md
```

Then point `.claude/rules/*.md` at the specific file. This is the single largest
reduction in tokens-read with no loss of information.

### 12. Playwright for Obsidian

The original `AGENTS.md` mentioned Playwright for integration tests. Obsidian is an
Electron app with no exposed test harness — doable, but expensive. **Proposal:** Vitest
for unit tests, a manual checklist for integration, and no Playwright until there's a
concrete reason.

### 13. Translate `design.md` itself

The spec is still in Vietnamese. For an open-source project that's the biggest remaining
barrier to outside contributors — and to any agent a contributor runs. Translating it is
a larger job than the files around it, but it's the one that decides whether people can
contribute at all.
