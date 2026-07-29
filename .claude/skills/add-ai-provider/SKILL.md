---
name: add-ai-provider
description: Use when adding a new AI provider (text, audio, or image) to the plugin, or when the user says "add support for <vendor>", "add a TTS provider", "wire up <model host>". Covers the full checklist from adapter file to settings UI to tests.
---

# Add a new AI provider

## Before writing code

1. Which task: text / audio / image? A vendor offering two tasks needs two adapters.
2. Cloud or local? This determines which settings fields appear and whether it needs
   an opt-in label.
3. Read the interface for that task in `docs/contracts.md`. Read `.claude/rules/providers.md`.

If the vendor's response shape doesn't fit the normalized output, stop and ask — do not
widen the shared interface without discussion.

## Checklist

- [ ] Create `src/providers/<task>/<vendor>.ts` implementing the task interface.
- [ ] Register it in the provider map in `providerManager.ts`. No other change to that file.
- [ ] Add settings fields in `settingsTab.ts` following the existing cloud-vs-local
      conditional pattern (design.md Module 6.2): API key for cloud, API URL for local,
      plus model / voice / size as the vendor requires.
- [ ] Label it clearly as **cloud** or **local** in the settings UI.
- [ ] Add defaults to `DEFAULT_SETTINGS`.
- [ ] Unit test: mock HTTP, assert normalized output shape.
- [ ] Unit test: failure path — non-200, malformed body, and timeout.
- [ ] Update the provider list in `docs/design.md` Module 2.2.
- [ ] Update `README.md` if it's a cloud provider — users need to know what data leaves
      the vault and where it goes.

## Verify

```bash
npm run lint && npm run type-check && npm run test:unit
```

Then manually: select the provider in settings, run the matching button on a real note,
and confirm the failure path too (wrong key, or provider stopped).

## Reminders

- No key in code, tests, or fixtures.
- Explicit timeout on every request.
- Errors reach the user through a Notice, with the provider name in the message.
