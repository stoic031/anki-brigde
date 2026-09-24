# VocabWeave

An [Obsidian](https://obsidian.md) plugin that syncs vocabulary notes from your vault
to [Anki](https://apps.ankiweb.net/) via [AnkiConnect](https://foosoft.net/projects/anki-connect/),
and can generate image media for those notes through pluggable AI providers
(cloud or local).

VocabWeave is an **orchestrator only** — it calls AnkiConnect and whatever AI
provider you configure; it never runs or bundles models itself, and it never writes
AI-generated media into your vault (media goes straight to Anki's media folder).

## Features

- Sync a note's content to an Anki note via AnkiConnect, with dynamic field mapping
  based on the Anki model you select (no hardcoded deck/model/field names). Edits made
  in Anki are detected on the next sync.
- A sidebar with sync / rebuild / delete buttons and AI generation controls for the
  active note, plus quick deck/model editing. Notes stay clean: just properties and
  `## Field` sections.
- Profiles (deck + model + save folder) for creating new notes, from scratch or from a
  text selection.
- Optional AI providers for text and image generation — bring your own API key,
  nothing is bundled or hardcoded.

## Requirements

- [Anki](https://apps.ankiweb.net/) with the [AnkiConnect](https://foosoft.net/projects/anki-connect/)
  add-on installed and running (default `http://localhost:8765`).
- Desktop only — this plugin talks to a local Anki instance and does not support
  Obsidian Mobile.

## Installation

Install **VocabWeave** from **Settings → Community plugins → Browse**, then enable it.

Manual install: download `main.js`, `manifest.json`, and `styles.css` from the latest
[release](https://github.com/stoic031/vocabweave/releases) into
`<YourVault>/.obsidian/plugins/vocabweave/`, reload Obsidian, and enable **VocabWeave**
under **Settings → Community plugins**.

## Network use and privacy

- **AnkiConnect** — the plugin talks to AnkiConnect on your machine
  (`http://localhost:8765` by default) to read decks/models and create, update, or
  delete notes and media.
- **AI providers are off by default.** Nothing is sent anywhere until you add a
  provider in settings. Each provider is labelled **cloud** or **local**:
  - Cloud: OpenAI, Anthropic, Gemini, Groq, OpenRouter, Together, Pollinations, or any
    OpenAI-compatible endpoint you enter.
  - Local: Ollama, Automatic1111, ComfyUI (or any `localhost` URL).
- **What is sent:** when you press Generate or Add image, the active note's word and
  fields, your prompt, your language settings, and examples you approved earlier go to
  the one provider you picked. No other notes are read.
- **API keys** are kept in Obsidian's secret storage and sent only to that provider.
- Generated images are stored in Anki's media folder, never in your vault.
- No telemetry, analytics, or ads.

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
`<Vault>/.obsidian/plugins/vocabweave/` and reload Obsidian, with Anki + AnkiConnect
running.

## Documentation

- [`AGENTS.md`](AGENTS.md) — repo layout and how-we-build-here conventions.
- [`docs/design/README.md`](docs/design/README.md) — behavior spec, module by module.
- [`docs/contracts.md`](docs/contracts.md) — concrete TypeScript interfaces and the
  field-mapping algorithm.

## License

[0BSD](LICENSE)
