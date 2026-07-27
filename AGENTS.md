# Obsidian-Anki AI Plugin — Agent Guide

## Project overview

- **What it is**: An Obsidian community plugin that syncs vocabulary notes from Obsidian into Anki, and can auto-generate audio/image media for those notes via pluggable AI providers (cloud or local).
- **Role of the plugin**: **Orchestrator only.** It calls external APIs (AnkiConnect, AI providers) — it never runs models itself and never bundles any model weights.
- **Target**: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- **Entry point**: `src/main.ts`, compiled to `main.js` and loaded by Obsidian.
- **Required release artifacts**: `main.js`, `manifest.json`, and `styles.css`.
- **Core dependencies (external, at runtime)**:
  - [AnkiConnect](https://foosoft.net/projects/anki-connect/) — local HTTP API exposed by Anki, default `http://localhost:8765`.
  - One or more AI providers for text / audio / image generation (see Module 2), selected and configured by the user.
- **Design source of truth**: `docs/design.md` (the full Vietnamese feature spec — modules 1, 2, 3, 5, 6, 7). Keep this AGENTS.md and the design doc in sync; if they conflict, the design doc describes _what_ to build and this file describes _how_ to build it in the repo.

## Environment & tooling

- Node.js: current LTS (Node 18+ recommended).
- **Package manager: npm.**
- **Bundler: esbuild** (`esbuild.config.mjs`). Bundle everything into `main.js` — no unbundled runtime deps.
- Types: `obsidian` type definitions (`obsidian.d.ts`).
- Linting: ESLint with `eslint-plugin-obsidianmd`.
- Formatting: Prettier.
- Tests: Vitest for unit tests; Playwright (or manual vault testing) for anything that touches the live Obsidian/Anki integration end-to-end.

### Common scripts

| Command                | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `npm install`          | Install dependencies                                         |
| `npm run dev`          | Build in watch mode                                          |
| `npm run build`        | Production build                                             |
| `npm run lint`         | ESLint check                                                 |
| `npm run format:write` | Format code with Prettier                                    |
| `npm run test:unit`    | Unit tests (parsers, field-mapping logic, provider adapters) |
| `npm run type-check`   | TypeScript type checking                                     |

A GitHub Action should lint and type-check every commit on all branches.

## File & folder conventions

Organize code by **module**, mirroring the design doc's module boundaries. Keep `main.ts` minimal — lifecycle only (`onload`, `onunload`, wiring up commands/views).

```
src/
  main.ts                  # Plugin entry point, lifecycle only
  settings.ts               # Settings interface, defaults, load/save
  types.ts                  # Shared TypeScript interfaces (Frontmatter, ParsedNote, ProviderResult, ...)

  sync/                     # Module 1: Core Sync Engine
    ankiConnect.ts          # Thin AnkiConnect client (addNote, updateNoteFields, storeMediaFile, deckNames, modelNames, modelFieldNames, deleteNotes)
    parser.ts               # Frontmatter + heading-based content parser
    fieldMapper.ts           # Dynamic content-section → Anki field mapping
    syncEngine.ts            # Orchestrates parse → map → addNote/updateNoteFields

  providers/                # Module 2: AI Provider Manager
    types.ts                # AIProvider interface (processText, generateAudio, generateImage)
    providerManager.ts       # Selects/instantiates providers per task, handles fallback
    text/                    # openai.ts, claude.ts, gemini.ts, ollama.ts, lmstudio.ts
    audio/                   # openaiTts.ts, azure.ts, elevenlabs.ts, edgeTts.ts, sherpaOnnx.ts
    image/                   # dalle.ts, stability.ts, replicate.ts, automatic1111.ts, comfyui.ts

  note/                      # Module 3: Note Creation & Controls
    controlsBlock.ts         # Renders %%anki-controls%% into buttons
    contentTemplate.ts        # Auto-generate content structure from model fields
    mediaNaming.ts            # _obsidian_{word}_{type}_{timestamp}.{ext}

  ui/                         # Module 5 & 7: UI components, views, modals
    settingsTab.ts            # Module 6: Settings Tab
    sidebarView.ts             # Module 7: Sidebar Modal (Deck & Model Selection)
    modals/                    # Confirm dialogs, input prompts
    toast.ts                   # Toast/notice helpers

  utils/
    helpers.ts
    constants.ts               # Default AnkiConnect URL, media prefix, timeouts

styles.css
manifest.json
versions.json
docs/
  design.md                    # The feature design doc (source of truth for behavior)
```

- **Do not commit build artifacts**: never commit `node_modules/`, `main.js`, or other generated files.
- Keep the plugin small. Avoid large dependencies; prefer browser-compatible packages (no Node-only libs in code paths that must run on mobile, if mobile support is ever added — see "Mobile" below).
- Release artifacts must end up at the top level of the plugin folder in the vault (`main.js`, `manifest.json`, `styles.css`).

## Manifest rules (`manifest.json`)

Must include:

- `id` — matches the folder name for local dev; **never changes after release**.
- `name`, `version` (SemVer `x.y.z`), `minAppVersion`, `description`.
- `isDesktopOnly` — **set to `true`.** AnkiConnect only listens on `localhost` and Anki itself is desktop software, so this plugin cannot function on Obsidian Mobile. Do not silently degrade — the settings tab and sidebar view should say plainly that this plugin requires desktop Anki + AnkiConnect.
- Optional: `author`, `authorUrl`, `fundingUrl`.

Canonical requirements: <https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml>

## Testing

- **Unit tests** (fast, no live Anki/AI needed): content parser, frontmatter round-trip, field-mapping logic, media filename generation, provider response normalization.
- **Manual/integration testing** against a real vault:

    ```
    <Vault>/.obsidian/plugins/<plugin-id>/
    ```

    Copy `main.js`, `manifest.json`, `styles.css`, reload Obsidian, enable the plugin under **Settings → Community plugins**.
- Before testing sync features, confirm Anki is running with AnkiConnect installed and reachable at the configured URL (default `http://localhost:8765`).
- Test the full error paths explicitly, not just the happy path: AnkiConnect offline, duplicate note, missing model, malformed content, AI provider timeout/failure, invalid API key.

## Commands & settings

- Add user-facing commands via `this.addCommand(...)` with **stable IDs** (never rename once released), e.g. `open-anki-sidebar`, `create-note-from-ai`.
- Settings tab (Module 6) and Sidebar view (Module 7) must stay in sync: changing Deck/Model in one place updates the other (shared state via `this.settings`, saved with `saveData` after every change).
- Persist settings using `this.loadData()` / `this.saveData()`. Provide sensible defaults for everything (AnkiConnect URL default `http://localhost:8765`, media prefix `_obsidian_`, Conflict Resolution default `prompt`).
- Validate settings input where it matters (media prefix has no special/path characters, API URLs are well-formed) before saving.

## Versioning & releases

- Follow **Conventional Commits** for commit messages: `type(scope): description`, e.g. `feat(sync): add dynamic field mapping`, `fix(providers): handle Ollama timeout`, `docs(readme): update AnkiConnect setup`.
- Bump `version` in `manifest.json` (SemVer) and add the corresponding entry to `versions.json` (plugin version → minimum Obsidian version).
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version` (no leading `v`).
- Attach `manifest.json`, `main.js`, `styles.css` as individual release assets.
- Keep a `CHANGELOG.md` grouped by type (✨ Features, 🐛 Bug Fixes, 📝 Documentation), newest first.

## Security, privacy, and compliance

This plugin talks to **two categories of external service**: AnkiConnect (local) and AI providers (local or cloud). Treat these differently.

- **AnkiConnect calls are local by default** (`localhost:8765`) and are essential to the plugin's core feature — no opt-in needed for these, but the URL must be user-configurable and never hardcoded to anything but localhost without explicit user input.
- **AI provider calls can leave the user's machine.** Any cloud provider (OpenAI, Claude, Gemini, Azure, ElevenLabs, DALL-E, Stability, Replicate, etc.) is **opt-in by construction**: the plugin ships with no provider selected/configured by default, and clearly labels which providers are cloud vs. local in the Settings Tab.
- **Never hardcode or bundle API keys.** All API keys are user-supplied, stored via `saveData` (Obsidian's local plugin data), and never transmitted anywhere except directly to the provider's own API endpoint the user selected.
- Disclose in `README.md` and in the Settings Tab exactly what data leaves the vault when a cloud provider is used (the word/sentence/meaning text sent for `processText`, `generateAudio`, `generateImage` — never the whole vault, never unrelated notes).
- **No hidden telemetry.** No analytics calls of any kind unless explicitly added, opt-in, and documented.
- Never execute remote code, `eval` fetched scripts, or auto-update plugin code outside normal Obsidian releases.
- **Minimize scope**: read/write only the active note's frontmatter + content needed for sync. Do not scan or access files outside the vault. Do not access other notes unless a feature explicitly requires it and the user initiated it.
- Media generated by AI providers goes straight to Anki via `storeMediaFile` — **never write generated media into the Obsidian vault.**
- Register and clean up all DOM, workspace, and interval listeners with `register*` helpers (`registerEvent`, `registerDomEvent`, `registerInterval`) so the plugin unloads safely and doesn't leak AI request state across reloads.
- Follow Obsidian's Developer Policies and Plugin Guidelines: <https://docs.obsidian.md/Developer+policies>.

## UX & copy guidelines

- Prefer sentence case for headings, buttons, and titles ("Add audio", not "Add Audio").
- Use bold for literal UI labels; use "select" for interactions (e.g. "select a **Deck**").
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short and consistent. Emoji prefixes are already part of this project's visual language (🔄 Sync, 🗑️ Delete, 🔊 Add Audio, 🖼️ Add Image, ✅/❌ status) — reuse the existing set from the design doc rather than inventing new icons per feature.
- Toast/notice copy should say what happened and, on failure, what to do next (e.g. "❌ Failed to sync. Please check Anki connection." rather than a bare error code).
- Long-running AI calls (5–30s) must show a persistent, updating notice — never leave the user staring at a static "Processing..." with no feedback.

## Performance

- Keep startup light; defer AnkiConnect/provider calls until a user actually interacts with the plugin (button click, command, sidebar open). Don't ping AnkiConnect on every `onload`.
- Avoid long-running work during `onload`; use lazy initialization for the AI Provider Manager.
- Batch AnkiConnect calls where possible (e.g. fetch `deckNames` + `modelNames` together on Connect, not on every render).
- Debounce content-parsing/re-render triggered by file-save events; don't re-parse on every keystroke.
- Never block the UI thread on network calls — every AnkiConnect/AI call is `async/await` with visible progress state.

## Coding conventions

- TypeScript with `"strict": true`.
- **Keep `main.ts` minimal**: only `onload`/`onunload`/command registration/view registration. All feature logic lives in the module folders above.
- **Split large files**: if a file exceeds ~250–300 lines, break it into smaller, focused modules (e.g. split `syncEngine.ts` from `fieldMapper.ts` rather than merging them).
- **One provider per file** under `providers/text|audio|image/`, all implementing the shared `AIProvider` interface (`processText` / `generateAudio` / `generateImage`) so adding a new provider never touches `providerManager.ts`'s core logic beyond a registration entry.
- Prefer `async/await` over promise chains; every AnkiConnect and AI provider call must have explicit try/catch with user-facing error handling (see Module 1.6 error cases: AnkiConnect offline, note not found, duplicate note, parse error, model not found).
- Content parsing must key off the `## Heading` structure described in the design doc (Module 1.5 / 3.3) — don't invent alternate parsing schemes (YAML-in-body, custom delimiters) without updating `docs/design.md` first.
- Bundle everything into `main.js` (no unbundled runtime deps).

## Mobile

- **This plugin is desktop-only** (`isDesktopOnly: true`) because AnkiConnect requires a locally running Anki instance. Do not attempt mobile compatibility work unless the architecture changes (e.g. a remote AnkiConnect proxy) — and if it ever does, that's a design-doc-level decision, not a silent code change.

## Agent do/don't

**Do**

- Read `docs/design.md` before implementing a module — it is the behavioral spec (data flow, field mapping table, button states, error messages).
- Add commands with stable IDs; never rename once released.
- Provide defaults and validation in settings (Module 6) and keep the Sidebar view (Module 7) in sync with them.
- Write idempotent sync logic: re-running Sync on an already-synced note updates fields rather than creating duplicates; a missing `anki_note_id` always means "create new".
- Use `this.register*` helpers for anything needing cleanup on unload.
- Implement the exact conditional button visibility rules from Module 3.2 (e.g. Delete only shows with `anki_note_id`; Add Audio only shows without `[sound:...]`).
- Follow the media naming convention (`_obsidian_{word}_{type}_{timestamp}.{ext}`) exactly — Anki's "Check Media" relies on the prefix to avoid deleting plugin-managed files.

**Don't**

- Introduce a new network call (new provider, telemetry, update-check) without documenting it in the Settings Tab and, if it's a cloud service, requiring explicit user opt-in/configuration.
- Store or transmit vault contents beyond the single note being synced/processed.
- Write AI-generated media into the Obsidian vault — it always goes to Anki via `storeMediaFile`.
- Hardcode any deck name, model name, or field name — everything must come from `deckNames`/`modelNames`/`modelFieldNames` and the user's selection.
- Overwrite an entire note's content when adding audio/image — always append into the correct `## Section` per Module 3.4.

## Common tasks

### Add a new AI provider (text/audio/image)

1. Create `src/providers/<task>/<providerName>.ts` implementing the shared interface for that task.
2. Register it in `providerManager.ts`'s provider map.
3. Add its settings fields (API key / model / voice / URL as applicable) to `settingsTab.ts`, following the existing cloud-vs-local conditional-field pattern (Module 6.2).
4. Add a unit test that mocks the HTTP call and checks the normalized output shape (`{ word, meaning, furigana, ... }` for text; `{ base64, filename }` for audio/image).

### Add a new button to the controls block

1. Add the action to `controlsBlock.ts` with its own visibility condition (mirror the pattern in Module 3.2).
2. Wire visual states: normal → processing ("⏳ …") → success ("✅ Done!", auto-hide/reset after ~2s) → error ("❌ Error", auto-reset after ~3s).
3. Trigger a toast notification on completion/failure (Module 5.2).
4. Update `docs/design.md` Module 3.2 so the spec stays authoritative.

### Add a new AnkiConnect action

```ts
// sync/ankiConnect.ts
async function ankiRequest<T>(
 action: string,
 params: Record<string, unknown> = {},
): Promise<T> {
 const res = await fetch(this.settings.ankiConnectUrl, {
  method: 'POST',
  body: JSON.stringify({ action, version: 6, params }),
 });
 const data = await res.json();
 if (data.error) throw new Error(data.error);
 return data.result as T;
}
```

Keep every AnkiConnect action as a small, typed wrapper function here — never call `fetch` directly from UI or sync-engine code.

### Persist settings

```ts
interface AnkiSyncSettings { ankiConnectUrl: string; mediaPrefix: string; /* ... */ }
const DEFAULT_SETTINGS: AnkiSyncSettings = {
  ankiConnectUrl: 'http://localhost:8765',
  mediaPrefix: '_obsidian_',
};

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<AnkiSyncSettings>);
}

async saveSettings() {
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(
 this.app.vault.on('modify', (file) => {
  /* debounce + re-render controls */
 }),
);
this.registerDomEvent(activeWindow, 'resize', () => {
 /* ... */
});
```

## Troubleshooting

- **Plugin doesn't load after build**: ensure `main.js` and `manifest.json` are at the top level of `<Vault>/.obsidian/plugins/<plugin-id>/`.
- **Build issues**: if `main.js` is missing, run `npm run build` or `npm run dev`.
- **"Anki is not running" modal appears even though Anki is open**: confirm AnkiConnect is installed in Anki and the configured URL matches (`http://localhost:8765` by default); check CORS/webCorsOriginList in AnkiConnect config if using a non-default Obsidian setup.
- **Buttons not appearing/disappearing correctly**: verify the content-parsing regex/heading matcher and the conditional-render logic in `controlsBlock.ts` match Module 3.2/3.3 exactly.
- **Sync creates duplicate notes**: check that `anki_note_id` is being read from and written back to frontmatter correctly, and that "Note not found in Anki" properly clears the stale ID before retrying.
- **AI provider calls hang or fail silently**: confirm the provider wrapper has a timeout and surfaces errors to the progress notice (Module 5.3) instead of failing silently.
- **Settings not persisting**: ensure `loadData`/`saveData` are awaited and the UI re-renders after changes; check that Settings Tab and Sidebar view are both reading/writing the same settings object.

## References

- Design spec (source of truth for behavior): `docs/design.md`
- Obsidian sample plugin AGENTS.md: <https://github.com/obsidianmd/obsidian-sample-plugin/blob/master/AGENTS.md>
- AnkiConnect documentation: <https://foosoft.net/projects/anki-connect/>
- Obsidian API documentation: <https://docs.obsidian.md>
- Obsidian developer policies: <https://docs.obsidian.md/Developer+policies>
- Obsidian plugin guidelines: <https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines>
- Style guide: <https://help.obsidian.md/style-guide>

## Agent Behavior Principles (Karpathy Guidelines)

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
