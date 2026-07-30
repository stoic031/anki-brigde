# Open questions — docs/design/

Places where `docs/design/` is undefined or contradicts itself. An agent will hit these
and **pick an interpretation on its own** if they aren't answered first. Resolve in order.

Once a question is settled: edit the relevant file in `docs/design/` directly and delete
the entry here.

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
