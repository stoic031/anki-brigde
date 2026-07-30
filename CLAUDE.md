@AGENTS.md

## Claude Code specifics

- Architecture and shared conventions: see AGENTS.md (imported above).
- Behavior spec: `docs/design/` — **read the relevant module file before writing code**,
  not the whole directory. Start at `docs/design/README.md` for the index.
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
