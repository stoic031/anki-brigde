# Open questions — docs/design/

Places where `docs/design/` is undefined or contradicts itself. An agent will hit these
and **pick an interpretation on its own** if they aren't answered first. Resolve in order.

Once a question is settled: edit the relevant file in `docs/design/` directly and delete
the entry here.

---

## 🟡 Blocking provider work

### 15. No Image provider scoped for Milestone 3

`docs/design/roadmap.md` Milestone 3 lists "Module 2: AI Provider Manager (OpenAI +
Ollama + Edge TTS)", but that milestone's own deliverable is "Plugin có thể tạo
audio/**image** và lưu vào Anki" — no Image provider is named to satisfy the image
half. `02-providers.md` §2.2 lists 5 image provider options (DALL-E 3, Stability AI,
Replicate, Automatic1111, ComfyUI) but roadmap.md doesn't pick one for M3. Blocks
scoping the Add Image button / Image provider work for Milestone 3. Resolve by either
naming one provider in roadmap.md's Milestone 3 bullet (DALL-E 3 pairs naturally with
the OpenAI text provider already in M3, same API key), or explicitly moving Add Image
to a later milestone and dropping "image" from M3's deliverable line.

### 14. `AudioOptions` / `ImageOptions` shape undefined

`docs/contracts.md` §4 uses `AudioOptions` and `ImageOptions` as parameter types for
`AudioProvider.generateAudio` / `ImageProvider.generateImage`, but neither type's fields
are specified anywhere in `docs/contracts.md` or `docs/design/`. `src/types.ts` currently
declares them as empty placeholder interfaces so the signatures compile. Needs real
fields (e.g. voice/speed for audio, style/size for image) before any provider adapter
can be implemented against them.

---

## 🟢 Worth doing, not blocking

### 16. `roadmap.md` milestone boundaries don't cover a working demo

Found while mapping Features/Tasks to milestones for GitHub issue planning:

- Milestone 1 lists Module 1/5/6 but not Module 3 — yet its deliverable ("tạo/cập nhật
  thẻ Anki từ Obsidian") requires the `anki-controls` block + Sync button
  (03-note.md §3.1, §3.2) to exist and be clickable. Recommend adding a minimal
  Module 3 line to M1's bullet list (block processor + Sync button only, not the full
  5-button set).
- Delete button (03-note.md §3.2), the "Auto Sync on Save" toggle, and Media Settings
  (06-settings.md §6.3-6.4) aren't assigned to any milestone. Recommend placing them
  explicitly (e.g. Delete → M2 alongside the rest of note-controls lifecycle, Auto
  Sync + Media Settings → M4 since neither blocks an earlier deliverable) rather than
  leaving them implicit.

### 10. No acceptance criteria per milestone

Each milestone currently has a one-line "Deliverable". Add a verifiable checklist —
for Milestone 1:

- [ ] Bad URL entered -> error shown, no crash
- [ ] Note without `anki_note_id` -> card created, ID written back to frontmatter
- [ ] Sync that same note again -> updated, **no** second card
- [ ] Anki quit mid-sync -> modal shown, frontmatter unchanged
- [ ] Card deleted in Anki, then re-synced -> new card created, stale ID replaced

### 12. Playwright for Obsidian

The original `AGENTS.md` mentioned Playwright for integration tests. Obsidian is an
Electron app with no exposed test harness — doable, but expensive. **Proposal:** Vitest
for unit tests, a manual checklist for integration, and no Playwright until there's a
concrete reason.

### 13. Translate `docs/design/` itself

The spec is still in Vietnamese. For an open-source project that's the biggest remaining
barrier to outside contributors — and to any agent a contributor runs. Translating it is
a larger job than the files around it, but it's the one that decides whether people can
contribute at all. The module split (see history, was #11) makes this easier to do
incrementally, one file at a time, instead of one 772-line pass.
