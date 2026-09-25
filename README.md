<div align="center">

# VocabWeave

**Write vocabulary in Obsidian. Study it in Anki. Let AI do the busywork.**

[![Latest release](https://img.shields.io/github/v/release/stoic031/vocabweave?style=flat-square&label=release)](https://github.com/stoic031/vocabweave/releases/latest)
[![Obsidian](https://img.shields.io/badge/Obsidian-%E2%89%A5%201.13.0-7c3aed?style=flat-square&logo=obsidian&logoColor=white)](https://obsidian.md)
[![Desktop only](https://img.shields.io/badge/platform-desktop-informational?style=flat-square)](#requirements)
[![License: 0BSD](https://img.shields.io/badge/license-0BSD-green?style=flat-square)](LICENSE)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-ffdd00?style=flat-square&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/stoic031)

</div>

<!-- Hero demo — uncomment once assets/demo.gif exists:
<p align="center"><img src="assets/demo.gif" alt="Creating a vocabulary note, generating its fields with AI and syncing it to Anki" width="800"></p>
-->

VocabWeave turns plain Obsidian notes into Anki flashcards. You keep one clean note per
word, with a heading for each field. VocabWeave maps those headings onto your Anki note
type and keeps both sides in sync. If you want, an AI provider of your choice can fill in
definitions and example sentences, and draw a picture for the card.

## Why VocabWeave

- **One source of truth.** Your vocabulary lives in your vault as readable Markdown, not
  locked inside Anki.
- **Works with your existing Anki setup.** Any deck, any note type, any field names.
  Nothing is hardcoded.
- **AI is optional and yours to choose.** Cloud or fully local, bring your own key, and
  review every result before it's written.
- **Your vault stays clean.** Generated images go straight into Anki's media folder,
  never into your vault.

## Features

### 🔄 Sync

- **Dynamic field mapping.** Each `## Heading` in the note fills the Anki field of the
  same name, and common aliases also work (for example `## Word` → `Front`).
- **Sync, rebuild, or delete** the active note from the sidebar in one click.
- **Two-way awareness.** If you edited the card in Anki, VocabWeave notices on the next
  sync and asks which version to keep instead of silently overwriting it.
- **Auto sync on save** (off by default) for notes that already have a deck and model.
- **The note name follows the main field**, so your file list reads like a word list.

### ✍️ Create

- **Profiles** bundle a deck, a note type, and a save folder, so switching languages is
  one dropdown.
- **Create new note** gives you an empty note with one section per field of the model.
- **Create note from selection** turns highlighted text into a new card note.

### ✨ AI (optional)

- **Generate field text** (meanings, example sentences, translations) into an
  editable preview. Nothing touches your note until you press **Write**.
- **Generate images** for a card. They're stored in Anki's media folder and still
  display inside Obsidian.
- **Language-aware.** Set your learning language and your own language once, and
  results follow them.

<!-- Screenshots — uncomment once the files exist:
<p align="center">
  <img src="assets/sidebar.png" alt="VocabWeave sidebar with profile, deck, model, and the Text and Image tabs" width="380">
  &nbsp;
  <img src="assets/settings.png" alt="VocabWeave settings: AnkiConnect, profiles and AI providers" width="380">
</p>
-->

## Requirements

- **Obsidian 1.13.0 or newer**, desktop only. VocabWeave talks to Anki on your own
  computer, so Obsidian Mobile isn't supported.
- **[Anki](https://apps.ankiweb.net/)** with the
  **[AnkiConnect](https://foosoft.net/projects/anki-connect/)** add-on (code
  `2055492159`), running while you sync.

## Quick start

1. **Install AnkiConnect** in Anki (_Tools → Add-ons → Get Add-ons…_, code
   `2055492159`), then restart Anki.
2. **Install VocabWeave** from _Settings → Community plugins → Browse_, and enable it.
3. Open **Settings → VocabWeave**, press **Connect**, then create a **profile** by
   picking a deck, a note type, and a folder for new notes.
4. Run the command **VocabWeave: Create new note**, name it, and fill in the sections.
5. Press **Sync** in the VocabWeave sidebar. The card is now in Anki. 🎉

## What a note looks like

A note is just properties plus one section per Anki field:

```markdown
---
anki_deck: Japanese::N2
anki_model: Basic
---

## Front

薬

## Back

medicine; drug
```

After the first sync, VocabWeave adds a few properties of its own (such as
`anki_note_id`) so it can update the same card next time. Leave them in place.

## Commands

| Command                        | What it does                                               |
| ------------------------------ | ---------------------------------------------------------- |
| `Create new note`              | Asks for a name and creates a note from the active profile |
| `Create note from selection`   | Creates a note from the selected text in the current note  |
| `Open deck and model selector` | Opens the VocabWeave sidebar                               |

Assign hotkeys to any of them in _Settings → Hotkeys_.

## AI providers

Add providers under **Settings → VocabWeave**. None are configured out of the box.

| Provider      | Runs  | Text | Image |
| ------------- | ----- | :--: | :---: |
| OpenAI        | Cloud |  ✅  |  ✅   |
| Gemini        | Cloud |  ✅  |  ✅   |
| OpenRouter    | Cloud |  ✅  |  ✅   |
| Anthropic     | Cloud |  ✅  |       |
| Groq          | Cloud |  ✅  |       |
| Together      | Cloud |  ✅  |       |
| Pollinations  | Cloud |      |  ✅   |
| Ollama        | Local |  ✅  |       |
| Automatic1111 | Local |      |  ✅   |
| ComfyUI       | Local |      |  ✅   |

Each provider's base URL can be changed, so self-hosted and compatible endpoints work
too. A provider pointing at `localhost` is labelled local.

## Privacy & network use

- **AnkiConnect (local):** VocabWeave connects to AnkiConnect on your computer
  (`http://localhost:8765` by default). It reads decks and note types, and creates,
  updates, or deletes notes and media.
- **AI providers are off by default.** Nothing leaves your computer until you add a
  provider yourself. Each provider is labelled **cloud** or **local** in settings.
- **What is sent:** when you press **Generate** or **Add image**, the active note's word
  and fields, your prompt, your language settings, and examples you approved earlier go
  to the one provider you picked. No other notes are read.
- **API keys** are stored in Obsidian's secret storage and sent only to their provider.
- **No telemetry, analytics, or ads.**

## Troubleshooting

<details>
<summary><b>"Anki is not running" but Anki is open</b></summary>

Check that AnkiConnect is installed (_Tools → Add-ons_) and that Anki was restarted
afterwards. If you changed AnkiConnect's address, set the same URL under
**Settings → VocabWeave → AnkiConnect URL**.

</details>

<details>
<summary><b>Sync says the note is a duplicate</b></summary>

Anki already has a note with the same first field. Change the first field in your note,
or delete the old card in Anki, then sync again.

</details>

<details>
<summary><b>An image shows in Anki but not in Obsidian</b></summary>

Images live in Anki's media folder, so Obsidian shows them only while Anki is running.
Open Anki and reopen the note.

</details>

Something else? [Open an issue](https://github.com/stoic031/vocabweave/issues). Steps
to reproduce and your Obsidian/Anki versions help a lot.

## Support ☕

VocabWeave is free and built in spare time. If it saves you time, you can buy me a
coffee to keep it going.

<a href="https://buymeacoffee.com/stoic031"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="48"></a>

Starring the repo and sharing it with other learners helps too. Thank you! 💛

## Contributing

Bug reports and pull requests are welcome.

<details>
<summary><b>Development setup</b></summary>

```bash
npm i                 # install dependencies
npm run dev           # build in watch mode
npm run build         # production build
npm run lint          # ESLint
npm run type-check    # tsc --noEmit
npm run test:unit     # Vitest
npm run format:write  # Prettier
```

A change is done when `npm run lint && npm run type-check && npm run test:unit` all pass.

For manual testing, copy `main.js`, `manifest.json`, and `styles.css` into
`<Vault>/.obsidian/plugins/vocabweave/`, reload Obsidian, and keep Anki + AnkiConnect
running.

- [`docs/design/`](docs/design/README.md): behavior spec, module by module
- [`docs/contracts.md`](docs/contracts.md): TypeScript interfaces and the field-mapping algorithm
- [`AGENTS.md`](AGENTS.md): repo layout and conventions

</details>

## License

[0BSD](LICENSE) © 2026 Andy Nguyen
