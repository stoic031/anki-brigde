# Anki Bridge

An [Obsidian](https://obsidian.md) plugin that syncs vocabulary notes from your vault
to [Anki](https://apps.ankiweb.net/) via [AnkiConnect](https://foosoft.net/projects/anki-connect/),
and can generate audio/image media for those notes through pluggable AI providers
(cloud or local).

Anki Bridge is an **orchestrator only** — it calls AnkiConnect and whatever AI
provider you configure; it never runs or bundles models itself, and it never writes
AI-generated media into your vault (media goes straight to Anki's media folder).

> **Status:** early development. The behavior described below is the design target —
> see [`docs/design/`](docs/design/README.md) for the full spec and
> [`docs/design/roadmap.md`](docs/design/roadmap.md) for what's built vs. planned.

## Features (target)

- Sync a note's content to an Anki note via AnkiConnect, with dynamic field mapping
  based on the Anki model you select (no hardcoded deck/model/field names).
- In-note controls (a custom `anki-controls` code block) to trigger sync and AI
  generation directly from the note.
- A sidebar modal for choosing Deck/Model and configuring audio/image generation
  per note.
- Pluggable AI providers for text, audio (TTS), and image generation — bring your
  own API key, nothing is bundled or hardcoded.
- Works entirely on your machine: Anki + AnkiConnect must be running locally.

## Requirements

- [Anki](https://apps.ankiweb.net/) with the [AnkiConnect](https://foosoft.net/projects/anki-connect/)
  add-on installed and running (default `http://localhost:8765`).
- Desktop only — this plugin talks to a local Anki instance and does not support
  Obsidian Mobile.

## Installation (manual, until this is on the community plugin list)

1. Download `main.js`, `manifest.json`, and `styles.css` from a
   [release](../../releases), or build them yourself (see below).
2. Copy them into `<YourVault>/.obsidian/plugins/anki-bridge/`.
3. Reload Obsidian and enable **Anki Bridge** under **Settings → Community plugins**.
4. Make sure Anki is running with AnkiConnect before using the plugin.

## Development

```bash
npm i               # install dependencies
npm run dev          # build in watch mode
npm run build        # production build
npm run lint          # ESLint
npm run type-check    # tsc --noEmit
npm run test:unit     # Vitest
npm run format:write   # Prettier
```

A change is considered done when lint, type-check, and unit tests all pass:

```bash
npm run lint && npm run type-check && npm run test:unit
```

For manual integration testing, copy `main.js`, `manifest.json`, `styles.css` into
`<Vault>/.obsidian/plugins/anki-bridge/` and reload Obsidian, with Anki + AnkiConnect
running.

## Documentation

- [`AGENTS.md`](AGENTS.md) — repo layout and how-we-build-here conventions.
- [`docs/design/README.md`](docs/design/README.md) — behavior spec, module by module.
- [`docs/contracts.md`](docs/contracts.md) — concrete TypeScript interfaces and the
  field-mapping algorithm.

## License

[0BSD](LICENSE)
