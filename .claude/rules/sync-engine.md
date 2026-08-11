---
paths:
    - 'src/sync/**/*.ts'
    - 'src/note/**/*.ts'
---

# Sync engine & AnkiConnect

Spec: `docs/design/01-sync.md` and `docs/design/03-note.md`. Contracts: `docs/contracts.md`.

## AnkiConnect access

All AnkiConnect traffic goes through one typed wrapper in `sync/ankiConnect.ts`.
Never call `fetch` against AnkiConnect from UI, sync-engine, or provider code — use
Obsidian's `requestUrl` instead (`eslint-plugin-obsidianmd` flags bare `fetch`; it
also sidesteps the CORS failures documented in `AGENTS.md`'s troubleshooting section).
`requestUrl` has no built-in timeout/abort, unlike `fetch` — race one with
`setTimeout` instead of `AbortSignal.timeout`.

```ts
// sync/ankiConnect.ts
import { requestUrl } from 'obsidian';

export class AnkiConnectClient {
 constructor(
  private url: string,
  private timeoutMs = 5000,
 ) {}

 async invoke<T>(
  action: string,
  params: Record<string, unknown> = {},
 ): Promise<T> {
  const timeoutError = new Error('timeout');
  let timer: ReturnType<typeof window.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
   timer = window.setTimeout(() => reject(timeoutError), this.timeoutMs);
  });

  let text: string;
  try {
   const response = await Promise.race([
    requestUrl({
     url: this.url,
     method: 'POST',
     contentType: 'application/json',
     body: JSON.stringify({ action, version: 6, params }),
     throw: false,
    }),
    timeout,
   ]);
   text = response.text;
  } catch (err) {
   if (err === timeoutError) throw new AnkiConnectError(action, `timed out after ${this.timeoutMs}ms`);
   throw new AnkiConnectError(action, 'could not reach AnkiConnect — is Anki running?');
  } finally {
   window.clearTimeout(timer);
  }

  const data = JSON.parse(text) as { result: T; error: string | null };
  if (data.error) throw new AnkiConnectError(action, data.error);
  return data.result;
 }

 deckNames() {
  return this.invoke<string[]>('deckNames');
 }
 modelFieldNames(modelName: string) {
  return this.invoke<string[]>('modelFieldNames', { modelName });
 }
 // one small typed method per action, each calling invoke()
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

Parse off the `## Heading` structure described in `docs/design/01-sync.md` §1.5 and
`docs/design/03-note.md` §3.3. A section
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

Every case in `docs/design/01-sync.md` §1.6 needs an explicit branch and a user-facing message:
AnkiConnect offline, note not found, duplicate note, parse error, model not found.
Silent `catch {}` is never acceptable — surface it through a Notice.
