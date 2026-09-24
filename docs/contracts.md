# Contracts

`docs/design/` describes behavior in prose. This file is the machine-readable half: the
exact types and algorithms, so an agent doesn't invent a shape in `parser.ts` and a
different one in `providerManager.ts`.

> Items marked **[NEEDS DECISION]** are proposals filling gaps in `docs/design/`.
> Confirm or change them before starting Milestone 1.

## 1. Frontmatter

```ts
interface AnkiFrontmatter {
	anki_note_id?: number; // absent = never synced
	anki_deck: string; // "Japanese::N2"
	anki_model: string; // "Basic (and reversed card)"
	last_synced?: string; // ISO 8601 UTC
	tags?: string[];
}
```

`last_synced` is display-only and must **not** drive any sync decision.

All frontmatter writes go through `app.fileManager.processFrontMatter()`, never string
manipulation.

## 2. Parsed note

```ts
type SectionValue = string | string[]; // list sections (lines starting with '-') are string[]; everything else is string

interface ParsedNote {
	frontmatter: AnkiFrontmatter;
	sections: Map<string, SectionValue>; // key = normalized heading (lowercased, trimmed)
	raw: string;
}
```

A section's value is a **string** for text content and for `[sound:...]`/`<img src="...">`
tags (extracted verbatim, whole-section match only — a tag merely mentioned inside a
longer sentence does not trigger extraction). It is a **string array** only when the
section is a bullet list (every collected line starts with `-`, marker stripped). An
empty section is `''`, never `undefined` — the key is still present in the map.

Normalize keys with `heading.trim().toLowerCase()`. Keep the original spelling around so
warnings can quote what the user actually typed.

## 3. Field mapping (Module 1.5) — deterministic algorithm

Input: `sections` plus `fields = await modelFieldNames(model)`.
Output: `Record<string, string>` plus a list of warnings.

```
Pass 1 — exact name match (case-insensitive)
  For each field in model order: if sections has a matching key, assign and mark used.

Pass 2 — alias match
  For each still-empty field: take the first unused section matching that field's aliases.

Pass 3 — positional fallback
  Runs ONLY if passes 1 and 2 mapped nothing at all.
  Assign the first N sections (in document order) to the model's first N fields.
  Always emit a warning.

Afterwards:
  Unmapped field   -> empty string.
  Unmapped section -> collect and emit ONE warning:
    "3 sections not mapped to model 'X': Collocations, Part of Speech, Notes"
```

Never drop a section silently. The user typed it for a reason.

```ts
const FIELD_ALIASES: Record<string, string[]> = {
	front: ['word', 'term', 'expression'],
	back: ['meaning', 'definition', 'translation'],
	audio: ['sound', 'pronunciation'],
	image: ['picture', 'illustration'],
	furigana: ['reading', 'kana'],
	example: ['sentence', 'usage'],
};
```

### What gets written into media fields

Anki needs the **full tag**, not a bare filename. Writing only the filename produces a
card that displays text instead of playing audio.

| Field | Value written to Anki    |
| ----- | ------------------------ |
| Audio | `[sound:{filename}]`     |
| Image | `<img src="{filename}">` |

`docs/design/01-sync.md` §1.5 says "extract filename", which is the most misreadable line in the spec.

## 4. AI providers

Code: `src/providers/types.ts`.

```ts
interface TextResult {
	[fieldName: string]: string; // keyed by exact Anki field name from targetFields
}

interface MediaResult {
	base64: string; // raw base64, NO "data:...;base64," prefix
	ext: string; // e.g. "png" — no leading dot
	mimeType: string;
}

interface ImageOptions {
	size?: string; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
	steps?: number; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
	negativePrompt?: string; // Settings Tab Image provider config — docs/design/06-settings.md §6.2
}

interface TextContext {
	targetLanguage?: string; // the selected profile's Learning language, docs/design/06-settings.md §6.1
	nativeLanguage?: string; // global "Your language", docs/design/06-settings.md §6.2
	examples?: ApprovedCard[]; // last ≤3 cards the user wrote for this Deck+Model
}

interface ApprovedCard {
	word: string; // Main Field value
	fields: Record<string, string>; // field name → value the user wrote
}

interface TextProvider {
	id: string;
	isCloud: boolean;
	processText(
		input: string,
		task: TextTask,
		targetFields: string[], // fields the user ticked in the Generate-with-AI modal
		context?: TextContext,
	): Promise<TextResult>;
}
interface ImageProvider {
	id: string;
	isCloud: boolean;
	generateImage(prompt: string, opts: ImageOptions): Promise<MediaResult>;
}

type TextTask =
	| 'extract-vocabulary'
	| 'generate-example'
	| 'rewrite'
	| 'build-image-prompt'; // input = the card's fields, result = the prompt for ImageProvider
```

`targetFields` comes straight from `modelFieldNames()` for the note's Model — the
provider is told exactly which fields exist (e.g. "Meaning", "Furigana", "Pinyin",
"Gender") and must interpret each field name itself to produce sensible content. A
field it can't or doesn't know how to fill is simply omitted/empty from the result,
same as the existing "field không rỗng" rule for consuming it.

For task `build-image-prompt`, `targetFields` is `[]` and the result is `{ idea?: string; prompt: string }` — `idea` is the model's planning line (chosen sense + visual idea), written first and never used; only `prompt` goes to the image provider.

`context` is optional and, when either field is set, appends one line to the system
prompt (`src/providers/text/prompt.ts`'s `buildMessages`): `Context: the user is
learning {targetLanguage} and explains best in {nativeLanguage}.` (only the parts that
are actually set). **`build-image-prompt` never receives a context line**, even if a
`context` is passed — that task stays English-only regardless (resolved
`docs/design-open-questions.md` #19).

A provider **returns a `MediaResult`. It does not name files and does not call
`storeMediaFile`.** Naming belongs to `note/mediaNaming.ts`; storage belongs to
`sync/ankiConnect.ts`. Keeping that boundary means swapping providers never touches
storage logic.

## 5. Media file naming

Format: `{prefix}{word}_{type}_{timestamp}.{ext}`

- `prefix` — defaults to `_obsidian_`, user-configurable, **never empty**. Anki's
  "Check Media" relies on it to avoid deleting plugin-managed files.
- `timestamp` — Unix **seconds**: `Math.floor(Date.now() / 1000)`. **[NEEDS DECISION]** —
  the design doc's examples use seconds for media but milliseconds for `anki_note_id`.
- `word` — comes from user content and **must be sanitized**:

```ts
export function sanitizeForFilename(word: string): string {
	return (
		word
			.normalize('NFC')
			.replace(/[\u0000-\u001f\u007f]/g, '') // control characters
			.replace(/[\\/:*?"<>|[\]]/g, '') // path separators and Anki-hostile chars
			.replace(/\s+/g, '_')
			.replace(/^\.+/, '') // no leading dots
			.slice(0, 40) || 'note'
	);
}
```

Unicode is preserved — a filename containing 診察 is valid. Square brackets must be
stripped: one that survives into a filename breaks the `[sound:...]` syntax.

`sanitizeForFilename` is also reused, unmodified, by the hotkey/quick-capture flow
(`docs/design/03-note.md` §3.7) to turn the user's selected text into a new **note**
filename — the same 40-char truncation and Unicode-preservation rules apply there as to
media filenames.

Required test cases:

| Input          | Output    |
| -------------- | --------- |
| `診察`         | `診察`    |
| `look up`      | `look_up` |
| `a/b`          | `ab`      |
| `[test]`       | `test`    |
| `...`          | `note`    |
| `""` (empty)   | `note`    |
| 200 characters | 40 chars  |

## 6. Errors

```ts
class AnkiConnectError extends Error {
	constructor(
		public action: string,
		public ankiMessage: string,
	) {
		super(`AnkiConnect '${action}' failed: ${ankiMessage}`);
	}
}

class ProviderError extends Error {
	constructor(
		public providerId: string,
		public cause: string,
	) {
		super(`${providerId}: ${cause}`);
	}
}
```

Every user-visible error states **what broke** and **what to do next**. An empty
`catch {}` is never acceptable.

## 7. Settings (`src/settings.ts`)

```ts
interface Profile {
	id: string; // stable, generated on Add ('default' for the auto-created one)
	name: string; // unique, non-empty
	deck: string; // '' = unset
	model: string; // '' = unset
	folder: string; // '' = vault root
	mainField: string; // '' = unset — seeds mainFieldConfig for this Deck+Model pair on first note creation, docs/design/06-settings.md §6.1
	targetLanguage: string; // '' = unset — AI context (TextContext.targetLanguage), docs/design/06-settings.md §6.1
}

interface AnkiBridgeSettings {
	ankiConnectUrl: string; // '' = unset, resolves to DEFAULT_ANKI_CONNECT_URL at use time
	profiles: Profile[]; // always >= 1 — a named Deck+Model+Folder bundle for NEW notes, docs/design/06-settings.md §6.1
	activeProfileId: string; // always an id in `profiles` — selected in both Settings Tab and Sidebar Tab 1
	generateWithAiFields: Record<string, string[]>; // Tab 1 field checkboxes, keyed by fieldConfigKey(deck, model)
	mainFieldConfig: Record<string, string>; // Main Field dropdown (below Model), keyed by fieldConfigKey(deck, model); '' / absent = not configured
	nativeLanguage: string; // '' = unset — global, AI context (TextContext.nativeLanguage), docs/design/06-settings.md §6.2
}
```

The active profile decides Deck/Model/Folder for **new** notes only — see
`resolveQuickCaptureTarget` in `src/note/quickCapture.ts`, shared by "Create new note" and
"Create note from selection"; it returns `null` when the profile has no Deck or Model. An
existing note's Deck/Model always come from its own `anki_deck` / `anki_model` frontmatter.

`loadSettings` migrates pre-profile data once: with no saved `profiles`, it creates a
`Default` profile from `currentDeck/Model/Folder` (falling back to `defaultDeck/Model/
Folder`) and drops those legacy keys; an unknown `activeProfileId` falls back to the first
profile. `plugin.setActiveProfile(id)` saves and fires `PROFILE_CHANGED_EVENT`
(`src/utils/constants.ts`) so Settings Tab and Sidebar re-render their profile selector.

`fieldConfigKey(deck, model)` encodes the pair as `JSON.stringify([deck, model])` rather
than a delimited string, because deck names routinely contain `::` (Anki's subdeck
separator) and a plain join risks two different pairs colliding on the same key.
