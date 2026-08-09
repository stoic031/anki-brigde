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
interface ParsedNote {
 frontmatter: AnkiFrontmatter;
 sections: Map<string, string>; // key = normalized heading (lowercased, trimmed)
 raw: string;
}
```

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

```ts
interface TextResult {
 [fieldName: string]: string; // keyed by exact Anki field name from targetFields
}

interface MediaResult {
 base64: string; // raw base64, NO "data:...;base64," prefix
 ext: string; // "mp3" | "png" — no leading dot
 mimeType: string;
}

interface AudioOptions {
 voice: string; // Sidebar Modal Tab 2, e.g. "Male" | "Female" — docs/design/07-sidebar.md §7.2.2
 language: string; // Sidebar Modal Tab 2, provider-dependent list — docs/design/07-sidebar.md §7.2.2
 speed?: number; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
}

interface ImageOptions {
 size?: string; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
 steps?: number; // docs/design/02-providers.md §2.4 mentions this; no UI sets it yet, providers may default it
 negativePrompt?: string; // Settings Tab Image provider config — docs/design/06-settings.md §6.2
}

interface TextProvider {
 id: string;
 isCloud: boolean;
 processText(
  input: string,
  task: TextTask,
  targetFields: string[], // fields the user ticked in the Generate-with-AI modal
 ): Promise<TextResult>;
}
interface AudioProvider {
 id: string;
 isCloud: boolean;
 generateAudio(text: string, opts: AudioOptions): Promise<MediaResult>;
}
interface ImageProvider {
 id: string;
 isCloud: boolean;
 generateImage(prompt: string, opts: ImageOptions): Promise<MediaResult>;
}

type TextTask = 'extract-vocabulary' | 'generate-example' | 'rewrite';
```

`targetFields` comes straight from `modelFieldNames()` for the note's Model — the
provider is told exactly which fields exist (e.g. "Meaning", "Furigana", "Pinyin",
"Gender") and must interpret each field name itself to produce sensible content. A
field it can't or doesn't know how to fill is simply omitted/empty from the result,
same as the existing "field không rỗng" rule for consuming it.

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
