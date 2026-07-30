---
type: community
members: 9
---

# Note Controls & Media Naming

**Members:** 9 nodes

## Members
- [[Auto-generate content structure from Model fields (§3.6)]] - concept - docs/design/03-note.md
- [[Create note from selection  hotkey quick-capture (§3.7)]] - concept - docs/design/03-note.md
- [[DeckModel selection persistence (§7.4)]] - concept - docs/design/07-sidebar.md
- [[Media file naming convention (§3.5)]] - concept - docs/design/03-note.md
- [[Media filename format {prefix}{word}_{type}_{timestamp}.{ext}]] - concept - docs/contracts.md
- [[Scenario 1 Create note from Sidebar Modal]] - concept - docs/design/scenarios.md
- [[Scenario 2 Create note from selection (hotkey) then Generate with AI]] - concept - docs/design/scenarios.md
- [[Sidebar Modal Create New Note action (§7.3)]] - concept - docs/design/07-sidebar.md
- [[sanitizeForFilename() spec]] - concept - docs/contracts.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Note_Controls__Media_Naming
SORT file.name ASC
```
