---
paths:
    - 'src/sync/**/*.ts'
    - 'src/note/**/*.ts'
---

# Sync engine & AnkiConnect

Spec: `docs/design.md` Module 1 and Module 3. Contracts: `docs/contracts.md`.

## AnkiConnect access

All AnkiConnect traffic goes through one typed wrapper in `sync/ankiConnect.ts`.
Never call `fetch` against AnkiConnect from UI, sync-engine, or provider code.

```ts
// sync/ankiConnect.ts
export class AnkiConnectClient {
 constructor(
  private url: string,
  private timeoutMs = 5000,
 ) {}

 private async request<T>(
  action: string,
  params: Record<string, unknown> = {},
 ): Promise<T> {
  const res = await fetch(this.url, {
   method: 'POST',
   signal: AbortSignal.timeout(this.timeoutMs),
   body: JSON.stringify({ action, version: 6, params }),
  });
  const data = await res.json();
  if (data.error) throw new AnkiConnectError(action, data.error);
  return data.result as T;
 }

 deckNames() {
  return this.request<string[]>('deckNames');
 }
 modelFieldNames(modelName: string) {
  return this.request<string[]>('modelFieldNames', { modelName });
 }
 // one small typed method per action
}
```

Pass the URL in at construction. Do **not** read `this.settings` inside a standalone
function — `this` won't be bound and it couples the client to the plugin instance.

## Sync must be idempotent

- No `anki_note_id` in frontmatter → `addNote`, then write the returned ID back.
- Has `anki_note_id` → `updateNoteFields`. Never create.
- AnkiConnect reports the note doesn't exist → clear `anki_note_id`, then `addNote`.
- Re-running sync on an unchanged note must be a no-op update, never a duplicate.

Write frontmatter with `app.fileManager.processFrontMatter()`, not string surgery.

## Content parsing

Parse off the `## Heading` structure described in design.md Module 1.5 / 3.3. A section
runs from its heading to the next heading of the same or higher level, or EOF.

Do not invent alternative schemes (YAML in body, custom delimiters, HTML comments) —
that's a design-doc change first, code change second.

## Content updates

Adding audio/image **appends into the matching `## Section`**. Never rewrite the whole
file. If the section is absent, create it at the end. Preserve everything else byte
for byte.

## Media filenames

Format: `{prefix}{word}_{type}_{timestamp}.{ext}`, default prefix `_obsidian_`.
The prefix is what stops Anki's "Check Media" from deleting plugin files — never omit it.

`word` comes from user content and **must be sanitized** before it becomes a filename:
strip path separators, control chars, and Anki-hostile characters; truncate to a fixed
length; keep the extension. Unicode (e.g. 診察) is allowed. See `docs/contracts.md` for
the exact rule and its unit tests.

## Error paths

Every case in design.md Module 1.6 needs an explicit branch and a user-facing message:
AnkiConnect offline, note not found, duplicate note, parse error, model not found.
Silent `catch {}` is never acceptable — surface it through a Notice.
