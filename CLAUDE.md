@AGENTS.md

## Claude Code specifics

- Architecture and shared conventions: see AGENTS.md (imported above).
- Behavior spec: `docs/design.md` — **read the relevant module before writing code**,
  not the whole file.
- Path-scoped rules live in `.claude/rules/` and load automatically when Claude opens a
  file matching their patterns.
- Repeatable procedures (adding a provider, adding a button) live in `.claude/skills/`.

### Use plan mode for these paths

Before touching `src/sync/`, `src/providers/`, or `manifest.json`: present a plan and
wait for approval. These areas affect the user's Anki data and the plugin's eligibility
for the Obsidian community store.

### Definition of done

A task is finished when all three pass:

```bash
npm run lint && npm run type-check && npm run test:unit
```

Don't run `npm run build` and report success — a green build says nothing about whether
the logic is correct.

<!-- Maintainer notes (stripped before Claude sees this file):
     - Once src/ contains real code, run /doctor. It proposes trimming the directory
       tree from AGENTS.md, since Claude can derive that from the codebase by then.
     - To check which files actually loaded, run /context and look under "Memory files".
-->
