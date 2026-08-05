# Obsidian-Anki AI Plugin — Agent Guide

Obsidian community plugin: sync vocabulary notes → Anki, and generate audio/image
media via pluggable AI providers. The plugin is an **orchestrator only** — it calls
external APIs (AnkiConnect, AI providers), never runs or bundles models.

- Stack: TypeScript → esbuild → single `main.js`. Package manager: **npm**.
- Entry: `src/main.ts`. Release artifacts: `main.js`, `manifest.json`, `styles.css`.
- Runtime deps (external): AnkiConnect at `http://localhost:8765`, plus whatever AI
  provider the user configures.
- **Behavior spec: `docs/design/`** (start at `docs/design/README.md`) — those files say
  _what_ to build, this one says _how_ to build it here. On conflict, docs/design/ wins
  for behavior; update this file.

## Non-negotiables

Violating any of these breaks user trust, Obsidian policy, or the release. Stop and
ask before doing any of them.

1. **Never write AI-generated media into the Obsidian vault.** Media goes to Anki via
   `storeMediaFile`, always.
2. **Never hardcode or bundle an API key.** Keys are user-supplied, stored via
   `saveData`, sent only to the provider endpoint the user chose.
3. **No cloud call without opt-in.** Ships with no provider configured. Settings tab
   must label each provider cloud vs local.
4. **No telemetry, no analytics, no remote code execution, no `eval` of fetched code,
   no self-update outside normal Obsidian releases.**
5. **Only touch the active note.** Never scan the vault or read unrelated notes.
6. **Never hardcode a deck / model / field name.** Everything comes from
   `deckNames` / `modelNames` / `modelFieldNames` + user selection.
7. **`isDesktopOnly: true` stays true.** AnkiConnect needs local Anki. Don't attempt
   mobile support — that's a design-doc decision, not a code change.
8. **Never rename a released command ID or the `manifest.json` `id`.**
9. **Don't commit build artifacts** (`node_modules/`, `main.js`).

Obsidian developer policies: <https://docs.obsidian.md/Developer+policies>

## Commands

| Command                | Purpose           |
| ---------------------- | ----------------- |
| `npm run dev`          | Build, watch mode |
| `npm run build`        | Production build  |
| `npm run lint`         | ESLint            |
| `npm run type-check`   | tsc, no emit      |
| `npm run test:unit`    | Vitest            |
| `npm run format:write` | Prettier          |

**Definition of done for every task:** `npm run lint && npm run type-check && npm run test:unit`
all pass. A green build alone is not done.

## Repo layout

Greenfield — this layout is a decision to follow, not a description of existing code.
Organize by module, mirroring `docs/design/`. Keep `main.ts` to lifecycle only
(`onload`, `onunload`, command/view registration).

```
src/
  main.ts              # lifecycle only
  settings.ts          # interface, DEFAULT_SETTINGS, load/save
  types.ts             # shared interfaces — see docs/contracts.md
  sync/                # Module 1: ankiConnect, parser, fieldMapper, syncEngine
  providers/           # Module 2: types, providerManager, text/, audio/, image/
  note/                # Module 3: controlsBlock, contentTemplate, mediaNaming
  ui/                  # Module 5+6+7: settingsTab, sidebarView, modals/, toast
  utils/               # helpers, constants
docs/
  design.md            # behavior spec (source of truth)
  contracts.md         # concrete TS interfaces + mapping algorithm
```

Once `src/` exists and is stable, delete this tree — Claude reads it from the
filesystem faster than from context.

## Conventions

- TypeScript `"strict": true`. Prefer `async/await` over promise chains.
- Split any file over ~250 lines into focused modules.
- Every AnkiConnect / AI call: explicit try/catch, user-facing error, timeout.
  Never block the UI thread.
- Use `this.register*` (`registerEvent`, `registerDomEvent`, `registerInterval`) for
  anything needing cleanup on unload.
- Lazy init: don't ping AnkiConnect or instantiate providers on `onload`. Wait for a
  user action. Debounce re-parsing on file-save; don't re-parse per keystroke.
- Conventional Commits: `feat(sync): add dynamic field mapping`,
  `fix(providers): handle Ollama timeout`.
- Settings validation before save: media prefix has no path/special chars, URLs parse.

Detailed per-area rules live in `.claude/rules/` and load automatically when you open
a matching file — don't duplicate them here.

## Where things live

| Need                                      | Go to                                   |
| ----------------------------------------- | --------------------------------------- |
| What a feature should do                  | `docs/design/` (read the module only)   |
| Exact interface / field-mapping algorithm | `docs/contracts.md`                     |
| Sync engine + AnkiConnect rules           | `.claude/rules/sync-engine.md`          |
| Provider adapter rules                    | `.claude/rules/providers.md`            |
| UI copy, button states, notices           | `.claude/rules/ui-copy.md`              |
| "Add a new AI provider" procedure         | `.claude/skills/add-ai-provider/`       |
| Unresolved spec questions                 | `docs/design-open-questions.md`         |

## Testing

- **Unit (Vitest, no live services):** content parser, frontmatter round-trip, field
  mapping, media filename generation + sanitization, provider response normalization.
  Mock all HTTP.
- **Manual integration:** copy `main.js`, `manifest.json`, `styles.css` into
  `<Vault>/.obsidian/plugins/<plugin-id>/`, reload Obsidian, enable under
  **Settings → Community plugins**. Anki must be running with AnkiConnect.
- **Always test error paths, not just happy path:** AnkiConnect offline, duplicate
  note, missing model, malformed content, provider timeout, invalid API key.

## Releases

- Bump `version` in `manifest.json` (SemVer) + add entry to `versions.json`.
- GitHub release tag matches `manifest.json` version exactly, **no leading `v`**.
- Attach `manifest.json`, `main.js`, `styles.css` as individual assets.
- `CHANGELOG.md` grouped by type, newest first.
- Manifest validation rules:
  <https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml>

## How to work

- **Ask before assuming.** If the design doc is ambiguous, say what's ambiguous and
  ask — don't pick an interpretation silently. Log it in
  `docs/design-open-questions.md`.
- **Minimum code that solves the problem.** No speculative abstractions, no config
  nobody asked for, no error handling for impossible states.
- **Surgical diffs.** Don't reformat or "improve" adjacent code. Match existing style.
  Clean up only the orphans your own change created; mention pre-existing dead code
  instead of deleting it. Every changed line should trace to the request.
- **Verifiable goals.** "Add validation" → "write tests for invalid input, then make
  them pass". For multi-step work, state the plan with a verification step per item.
- **Changing behavior means changing the spec.** Update the relevant `docs/design/`
  module file in the same change, not later.

## Troubleshooting

- **Plugin doesn't load:** `main.js` + `manifest.json` must be at the top level of
  `<Vault>/.obsidian/plugins/<plugin-id>/`. If `main.js` is missing, run `npm run build`.
- **"Anki is not running" but Anki is open:** AnkiConnect not installed, wrong URL, or
  Obsidian's origin missing from AnkiConnect's `webCorsOriginList`.
- **Duplicate notes on sync:** `anki_note_id` isn't being written back to frontmatter,
  or the "note not found" path isn't clearing the stale ID before retrying.
- **Buttons render wrong:** check the block processor and the visibility conditions
  against design.md Module 3.2/3.3.
- **Settings not persisting:** `loadData`/`saveData` not awaited, or Settings Tab and
  Sidebar view are holding separate objects instead of `this.settings`.

## References

- AnkiConnect: <https://foosoft.net/projects/anki-connect/>
- Obsidian API: <https://docs.obsidian.md>
- Plugin guidelines: <https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines>
- Obsidian style guide: <https://help.obsidian.md/style-guide>

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
