---
paths:
    - 'src/providers/**/*.ts'
---

# AI provider adapters

Spec: `docs/design.md` Module 2. Interfaces: `docs/contracts.md`.

## Structure

- **One provider per file.** `providers/text/ollama.ts`, `providers/audio/edgeTts.ts`, etc.
- Every provider implements the shared interface for its task (`processText`,
  `generateAudio`, `generateImage`). Adding a provider must not require editing
  `providerManager.ts` beyond one registration entry.
- Normalize at the adapter boundary. The provider returns the shared shape from
  `docs/contracts.md`; nothing downstream should know which vendor answered.

## Hard rules

- **No API key in code, in defaults, in tests, in fixtures, in comments.** Keys come
  from settings only.
- The key is sent to exactly one place: the endpoint of the provider the user selected.
- Every call has an explicit timeout and a try/catch that produces a user-facing
  message, not a console log.
- Adding a provider means adding its settings fields **and** labeling it cloud or local
  in the settings tab. A new network destination the user can't see is a policy violation.
- Never log request or response bodies — they contain the user's vocabulary content and
  possibly their key.

## Local providers

Ollama (`localhost:11434`), LM Studio, Automatic1111 (`localhost:7860`), ComfyUI,
sherpa-onnx. These are user-hosted: assume they may be absent, slow to cold-start, or
running a model that returns a different shape. Fail with a message that names the
provider and the URL that didn't answer.

## Text output must be validated

`processText` returns JSON produced by a language model. Never `JSON.parse` it straight
into typed state:

1. Strip markdown fences if present.
2. Parse inside try/catch.
3. Validate required fields exist and are the right type.
4. On failure, surface a parse error — don't silently return a half-filled object.

## Tests

Each provider needs a unit test that mocks the HTTP layer and asserts the **normalized
output shape**, plus one test for the failure path (non-200, malformed body, timeout).
No test may make a real network call.
