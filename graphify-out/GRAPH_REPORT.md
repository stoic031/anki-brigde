# Graph Report - anki-bridge  (2026-09-22)

## Corpus Check
- 137 files · ~83,850 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1028 nodes · 1835 edges · 111 communities (43 shown, 68 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e6831e0d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Create Note From Selection (Hotkey / Quick Capture)
- graphify Skill (/graphify)
- devDependencies
- compilerOptions
- Field Mapping Algorithm (3-pass deterministic)
- AnkiConnectClient
- noteNameModal.test.ts
- SidebarView
- Graphify Full Pipeline
- docs/contracts.md
- manifest.json
- Milestone 1: Core Sync + Settings
- docs/design/01-sync.md
- MediaResult interface
- imageTab.test.ts
- settingsTab.test.ts
- TextProvider interface
- graphify.js
- deckModelChangeWarning.test.ts
- version-bump.mjs
- build_merge Direct Graph Read
- Incremental --update Flow
- Node.js Build & Lint CI
- Definition of Done (lint + type-check + test:unit)
- AnkiConnectError class
- Media File Naming Format
- Media File Naming Convention (_obsidian_ prefix)
- Module Numbering Gap (3 to 5) Note
- Local AI Providers
- No API Key In Code Rule
- Provider Unit Test Requirement
- Provider Text Output Validation
- AnkiConnectClient
- Content Update Append Rule
- Listener Cleanup Rule
- Long Operation Feedback
- Shared Settings State Rule
- Themed Styling Rule
- /graphify add URL Ingestion
- --watch Background Watcher
- Token Reduction Benchmark
- Graphify MCP Server
- Neo4j / FalkorDB Export
- Calls Edge Direction & Language-Purity Rule
- Confidence Score Rubric
- Hyperedge Usage Guidance
- Node ID Format Rule
- Semantic Similarity Edge Guidance
- Monorepo Multi-Subfolder Merge
- BFS vs DFS Traversal Modes
- save-result Feedback Loop
- Constrained Query Expansion (Step 0)
- Self-Composed Whisper Prompt
- --cluster-only Self-Contained Rerun
- AST vs Semantic Extraction Split
- Graphify Query Fast Path
- Post-Pipeline Guide Behavior
- Graph Health Check (Step 4.5)
- Graphify Honesty Rules
- graphify usage rules (query/path/explain/update)
- CLAUDE.md — Claude Code specifics
- Use plan mode for src/sync, src/providers, manifest.json
- ProviderError class
- Sync data flow (§1.3)
- One-way sync only, no conflict resolution at M1-2
- Content Parsing Logic (heading-based)
- Delete Button
- Toast notifications (§5.2)
- Button visual feedback states (§5.1)
- AnkiConnect URL Connect-button flow (§6.1)
- Q13: Translate docs/design to English
- roadmap.md — development roadmap
- README.md — Obsidian Sample Plugin boilerplate
- graphify reference: GitHub clone and cross-repo merge
- Common Provider Interface (processText/generateAudio/generateImage)
- sidebarView.test.ts
- [1.1.0]
- settings.ts
- confirmRebuildFields.test.ts
- confirmDelete.test.ts
- textTab.test.ts
- sidebarView.ts
- src/types.ts
- textProviderSection.test.ts
- addImage.ts
- comfyWorkflow.ts
- Generate with AI Button
- quickCapture.ts
- FakeDropdown
- modelLists.ts
- imageProviderSection.test.ts
- profilesSection.ts
- FakeSetting
- Scenario 1: Create Note via Icon/Command
- noteActions.test.ts
- FakeText
- Sidebar Modal (Right Sidebar View Panel)
- FakeSetting
- FakeButton
- FakeDropdown
- FakeEl
- FakeTextComponent
- AnkiBridgeSettingTab
- main.ts
- FakeSecret
- FakeArea
- settingsTab.ts
- main.test.ts

## God Nodes (most connected - your core abstractions)
1. `AnkiBridgePlugin` - 35 edges
2. `ProviderError` - 24 edges
3. `AnkiConnectClient` - 23 edges
4. `SidebarView` - 22 edges
5. `resolveAnkiConnectUrl()` - 21 edges
6. `Common Provider Interface (processText/generateAudio/generateImage)` - 20 edges
7. `FakeEl` - 19 edges
8. `AnkiBridgeSettings` - 18 edges
9. `fieldConfigKey()` - 18 edges
10. `toastError()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `graphify Skill (/graphify)` --references--> `GitHub Clone & Cross-Repo Merge`  [EXTRACTED]
  .opencode/skills/graphify/SKILL.md → .claude/skills/graphify/references/github-and-merge.md
- `graphify Skill (/graphify)` --references--> `Post-Commit Auto-Rebuild Hook`  [EXTRACTED]
  .opencode/skills/graphify/SKILL.md → .claude/skills/graphify/references/hooks.md
- `AGENTS.md Non-Negotiables (9 rules)` --rationale_for--> `MediaResult interface`  [INFERRED]
  AGENTS.md → docs/contracts.md
- `Q12: Playwright-for-Obsidian proposal (use Vitest instead)` --references--> `Definition of Done (lint + type-check + test:unit)`  [INFERRED]
  docs/design-open-questions.md → AGENTS.md
- `Q10: Milestone 1 acceptance criteria checklist` --conceptually_related_to--> `Scenario 1: Create Note via Icon/Command`  [INFERRED]
  docs/design-open-questions.md → docs/design/scenarios.md

## Import Cycles
- 3-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/imageProviderSection.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/mediaSection.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/profilesSection.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/textProviderSection.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/noteActions.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/textTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/createNote.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/quickCapture.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/note/addImage.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/createNote.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/noteActions.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/createNote.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/textTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/quickCapture.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/noteActions.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/quickCapture.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/textTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/imageProviderSection.ts -> src/ui/providerSection.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/textProviderSection.ts -> src/ui/providerSection.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/textTab.ts -> src/note/generateFields.ts -> src/main.ts`
- 5-file cycle: `src/main.ts -> src/note/createNote.ts -> src/note/quickCapture.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/main.ts`
- 5-file cycle: `src/main.ts -> src/note/createNote.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/note/addImage.ts -> src/main.ts`
- 5-file cycle: `src/main.ts -> src/note/quickCapture.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/note/addImage.ts -> src/main.ts`

## Hyperedges (group relationships)
- **All Cloud/Local Providers Implementing The Common Provider Interface** — docs_design_02_providers_provider_interface, docs_design_02_providers_openai_gpt, docs_design_02_providers_claude, docs_design_02_providers_gemini, docs_design_02_providers_ollama, docs_design_02_providers_lm_studio, docs_design_02_providers_openai_tts, docs_design_02_providers_azure_speech, docs_design_02_providers_elevenlabs, docs_design_02_providers_edge_tts, docs_design_02_providers_sherpa_onnx, docs_design_02_providers_dalle3, docs_design_02_providers_stability_ai, docs_design_02_providers_replicate, docs_design_02_providers_automatic1111, docs_design_02_providers_comfyui [EXTRACTED 1.00]
- **Sidebar Modal's Three Config Tabs Forming One Configuration Surface** — docs_design_07_sidebar_sidebar_modal, docs_design_07_sidebar_tab1_note, docs_design_07_sidebar_tab2_audio, docs_design_07_sidebar_tab3_image [EXTRACTED 1.00]
- **Generate with AI / Add Audio / Add Image Share The Same Pre-check-then-generate Pattern** — docs_design_03_note_generate_with_ai_button, docs_design_03_note_add_audio_button, docs_design_03_note_add_image_button, docs_design_03_note_precheck [EXTRACTED 1.00]
- **Add-Provider Governance Flow (Rule + Skill + Spec)** — _claude_rules_providers_adapter_pattern, _claude_skills_add_ai_provider_skill_checklist, docs_design_02_providers_spec, docs_contracts_interfaces [INFERRED 0.85]
- **Graphify Conditional Reference-Doc Architecture** — _claude_skills_graphify_skill_pipeline, _claude_skills_graphify_references_add_watch_overview, _claude_skills_graphify_references_github_and_merge_overview, _claude_skills_graphify_references_update_overview, _claude_skills_graphify_references_query_overview, _claude_skills_graphify_references_hooks_overview, _claude_skills_graphify_references_exports_overview, _claude_skills_graphify_references_transcribe_overview, _claude_skills_graphify_references_extraction_spec_subagent_prompt [EXTRACTED 1.00]
- **Graph Integrity Safeguards Across the Pipeline** — _claude_skills_graphify_skill_shrink_guard, _claude_skills_graphify_skill_manifest_stamping, _claude_skills_graphify_references_update_build_merge, _claude_skills_graphify_references_update_cluster_only [INFERRED 0.85]
- **Four sequential development milestones forming the project roadmap** — docs_design_roadmap_milestone1, docs_design_roadmap_milestone2, docs_design_roadmap_milestone3, docs_design_roadmap_milestone4 [INFERRED 0.85]
- **Pluggable AI Provider Interfaces** — docs_contracts_textprovider, docs_contracts_audioprovider, docs_contracts_imageprovider, docs_design_02_providers_abstraction_layer [INFERRED 0.85]
- **AST + Semantic Extraction Forming the Merged Graph Build** — opencode_skills_graphify_skill_ast_extraction, opencode_skills_graphify_skill_semantic_extraction, opencode_skills_graphify_references_extraction_spec_node_id_format, opencode_skills_graphify_references_extraction_spec_confidence_rubric [INFERRED 0.85]

## Communities (111 total, 68 thin omitted)

### Community 0 - "Create Note From Selection (Hotkey / Quick Capture)"
Cohesion: 0.20
Nodes (18): generateAudio(), generateImage(), Add Audio Button, Add Image Button, Content Update Logic (Overwrite/Append), Create Note From Selection (Hotkey / Quick Capture), No Default Hotkey Shipped Decision, Never Overwrite User-Entered Section Content Principle (+10 more)

### Community 1 - "graphify Skill (/graphify)"
Cohesion: 0.11
Nodes (27): GitHub Clone & Cross-Repo Merge, Post-Commit Auto-Rebuild Hook, AGENTS.md graphify Integration Rules, /graphify add <url>, --watch (auto-rebuild watcher), Token reduction benchmark, FalkorDB export (--falkordb/--falkordb-push), MCP stdio server (--mcp) (+19 more)

### Community 2 - "devDependencies"
Cohesion: 0.05
Nodes (40): esbuild, eslint, @eslint/js, eslint-plugin-obsidianmd, globals, jiti, obsidian, description (+32 more)

### Community 3 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, ES2021, src/**/*.ts, compilerOptions, allowSyntheticDefaultImports, forceConsistentCasingInFileNames, inlineSourceMap, inlineSources (+12 more)

### Community 4 - "Field Mapping Algorithm (3-pass deterministic)"
Cohesion: 0.33
Nodes (7): Repo Layout (src/ module organization), AnkiFrontmatter interface, FIELD_ALIASES map, Field Mapping Algorithm (3-pass deterministic), ParsedNote interface, Dynamic Field Mapping (§1.5), Q10: Milestone 1 acceptance criteria checklist

### Community 5 - "AnkiConnectClient"
Cohesion: 0.08
Nodes (20): AnkiConnectClient, { requestUrl }, mapContentToFields(), stringifySectionValue(), readAnkiFrontmatter(), createNote(), deleteNote(), isNoteNotFound() (+12 more)

### Community 6 - "noteNameModal.test.ts"
Cohesion: 0.09
Nodes (6): NoteNameModal, FakeButtonComponent, FakeSetting, FakeTextComponent, openModal(), { settings, modalState }

### Community 8 - "Graphify Full Pipeline"
Cohesion: 0.15
Nodes (13): Graphify-First Directive, Add URL & Watch Folder Reference, Extra Exports & Benchmark Reference, Extraction Subagent Prompt Template, GitHub Clone & Merge Reference, Native CLAUDE.md Integration, Commit Hook & CLAUDE.md Integration Reference, Query/Path/Explain Reference (+5 more)

### Community 9 - "docs/contracts.md"
Cohesion: 0.22
Nodes (11): Provider Adapter Pattern, Normalize At Adapter Boundary, Media Filename Format, Copy Style Rules, Add AI Provider Checklist, Add Provider Pre-Check, docs/contracts.md, docs/design/02-providers.md (+3 more)

### Community 10 - "manifest.json"
Cohesion: 0.20
Nodes (9): author, authorUrl, description, fundingUrl, id, isDesktopOnly, minAppVersion, name (+1 more)

### Community 11 - "Milestone 1: Core Sync + Settings"
Cohesion: 0.29
Nodes (7): Module 1: Core Sync Engine, Module 5: UI/UX, Module 6: Settings Tab (Connection Flow), Milestone 1: Core Sync + Settings, Milestone 2: Sidebar Modal + Dynamic Fields, Milestone 3: AI Integration, Milestone 4: Polish & UX

### Community 12 - "docs/design/01-sync.md"
Cohesion: 0.33
Nodes (6): Heading-Based Content Parsing, Sync Error Path Coverage, Idempotent Sync Rule, Button State Cycle, docs/design/01-sync.md, docs/design/03-note.md

### Community 13 - "MediaResult interface"
Cohesion: 0.50
Nodes (5): AGENTS.md Non-Negotiables (9 rules), AudioProvider interface, ImageProvider interface, MediaResult interface, Q14: AudioOptions/ImageOptions shape undefined

### Community 14 - "imageTab.test.ts"
Cohesion: 0.11
Nodes (13): imageProvider, { modelFieldNames, storeMediaFile }, note, textProvider, ImageFieldConfig, FakeSetting, { modelFieldNames, AnkiConnectClient }, note (+5 more)

### Community 15 - "settingsTab.test.ts"
Cohesion: 0.05
Nodes (16): { deckNames, modelNames }, FakeButtonComponent, fakeDiv(), FakeDropdownComponent, FakeEl, FakeFolder, fakePlugin(), fakeRoot (+8 more)

### Community 16 - "TextProvider interface"
Cohesion: 0.67
Nodes (3): TextProvider interface, TextResult interface, TextTask type

### Community 18 - "deckModelChangeWarning.test.ts"
Cohesion: 0.12
Nodes (5): DeckModelChangeWarningModal, FakeButtonComponent, FakeSetting, openModal(), { settings, modalState }

### Community 77 - "Common Provider Interface (processText/generateAudio/generateImage)"
Cohesion: 0.12
Nodes (17): Provider Abstraction Layer, Automatic1111 (Image, Local), Azure Speech (Audio, Cloud), Claude (Text, Cloud), ComfyUI (Image, Local), DALL-E 3 (Image, Cloud), Edge TTS (Audio, Cloud, free), ElevenLabs (Audio, Cloud) (+9 more)

### Community 78 - "sidebarView.test.ts"
Cohesion: 0.05
Nodes (20): Case, { deckModelWarningOpen, deckModelWarningCapture }, { deckNamesMock, modelNamesMock, AnkiConnectClient }, fakeApp(), FakeButtonComponent, FakeDropdownComponent, fakePlugin(), FakeSetting (+12 more)

### Community 79 - "[1.1.0]"
Cohesion: 0.14
Nodes (13): [1.0.0], [1.1.0], Added, Added, Added, Changed, Changelog, Fixed (+5 more)

### Community 80 - "settings.ts"
Cohesion: 0.09
Nodes (37): plugin, $schema, .opencode/plugins/graphify.js, ModelKind, cloud(), IMAGE_PRESETS, ImageProviderId, presetLabel() (+29 more)

### Community 81 - "confirmRebuildFields.test.ts"
Cohesion: 0.12
Nodes (5): ConfirmRebuildFieldsModal, FakeButtonComponent, FakeSetting, openModal(), { settings, modalState }

### Community 82 - "confirmDelete.test.ts"
Cohesion: 0.12
Nodes (5): ConfirmDeleteModal, FakeButtonComponent, FakeSetting, openModal(), { settings, modalState }

### Community 83 - "textTab.test.ts"
Cohesion: 0.06
Nodes (15): CreateOpts, FakeEl, renderTabs(), Tab, render(), tabs, FakeSetting, FakeToggle (+7 more)

### Community 84 - "sidebarView.ts"
Cohesion: 0.21
Nodes (15): runAddImage(), AnkiConnectResponse, ActionButton, createActionButton(), runAction(), ImageTab, renderImageTab(), NoteActions (+7 more)

### Community 85 - "src/types.ts"
Cohesion: 0.09
Nodes (33): Cached, Factory, normalizeErrors(), ProviderConfig, ProviderKind, ProviderManager, ProviderManagerOptions, makeManager() (+25 more)

### Community 86 - "textProviderSection.test.ts"
Cohesion: 0.04
Nodes (13): clearModelCache(), cloud, FakeButton, FakeDropdown, FakeEl, FakeSecret, FakeSetting, FakeText (+5 more)

### Community 87 - "addImage.ts"
Cohesion: 0.12
Nodes (25): AddImageOutcome, AddImagePlan, planAddImage(), sectionText(), setup(), AiButtonAction, AiPreCheckResult, runAiPreCheck() (+17 more)

### Community 88 - "comfyWorkflow.ts"
Cohesion: 0.16
Nodes (24): analyzeWorkflow(), describeAnalysis(), fetchWorkflow(), fromApiFormat(), fromUiFormat(), get(), Graph, listWorkflows() (+16 more)

### Community 89 - "Generate with AI Button"
Cohesion: 0.23
Nodes (12): processText(), targetFields (processText input), TextResult (processText output), Auto-generate Content Structure, Generate with AI Button, Connection Status + Test Connection, Deck Dropdown, Field Checkboxes (Generate with AI) (+4 more)

### Community 90 - "quickCapture.ts"
Cohesion: 0.08
Nodes (34): generateContentSkeleton(), rebuildContent(), runCreateNote(), fakePlugin(), fakeSettings(), { modelFieldNamesMock, AnkiConnectClient }, { NoteNameModal, submitNoteName, resetCapturedSubmit }, { Notice } (+26 more)

### Community 92 - "modelLists.ts"
Cohesion: 0.15
Nodes (14): bearer(), Entry, Fetcher, FETCHERS, FILTERS, get(), listModels(), ModelList (+6 more)

### Community 93 - "imageProviderSection.test.ts"
Cohesion: 0.17
Nodes (7): clearWorkflowCache(), auto, { listModels }, { listWorkflows, fetchWorkflow }, { Notice, rendered, secrets }, openai, setup()

### Community 94 - "profilesSection.ts"
Cohesion: 0.23
Nodes (10): getActiveProfile(), renderFolderPicker(), renderPicker(), renderProfilesSection(), uniqueName(), renderConnectionSection(), buildFolderTreeEntries(), FolderTreeEntry (+2 more)

### Community 96 - "Scenario 1: Create Note via Icon/Command"
Cohesion: 0.32
Nodes (8): Branch A — Deck/Model Already Configured, Branch B — First-Time Setup Modal, Action: Create New Note (2-branch), Command: "Anki: Create new note" (id create-note), Ribbon Icon (create note + open modal), Scenario 1: Create Note via Icon/Command, Scenario 4: Change Deck/Model For Already-Synced Note, Warning Only Applies To Already-Synced Notes

### Community 97 - "noteActions.test.ts"
Cohesion: 0.18
Nodes (9): ActionState, { deleteModal, rebuildModal }, { modelFieldNames, AnkiConnectClient }, note, process, { setIcon }, setup(), { syncNote, deleteNote } (+1 more)

### Community 99 - "Sidebar Modal (Right Sidebar View Panel)"
Cohesion: 0.29
Nodes (7): AI Provider Manager, AI Buttons Never Write To Anki Directly (Sync-only) Principle, anki-controls Markdown Code Block, Sync Button, Command: "Anki: Open Deck & Model Selector", Sidebar Modal (Right Sidebar View Panel), Design Doc Architecture Overview

### Community 106 - "main.ts"
Cohesion: 0.29
Nodes (9): AnkiBridgePlugin, AnkiBridgeSettings, renderImageProviderSection(), AnyProviderConfig, ProviderSectionSpec, renderProviderSection(), uniqueName(), registerSidebarView() (+1 more)

### Community 111 - "settingsTab.ts"
Cohesion: 0.29
Nodes (5): renderMediaSection(), { Notice, settings }, render(), isValidMediaPrefix(), isValidUrl()

### Community 116 - "main.test.ts"
Cohesion: 0.33
Nodes (5): { loadSettings, saveSettings, getActiveTextConfig, getActiveImageConfig }, { PluginBase, addCommandSpy }, { registerSidebarView, revealSidebarView }, { runCreateNote }, { runQuickCapture }

## Knowledge Gaps
- **264 isolated node(s):** `$schema`, `.opencode/plugins/graphify.js`, `id`, `name`, `version` (+259 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **68 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AnkiBridgePlugin` connect `main.ts` to `noteActions.test.ts`, `SidebarView`, `AnkiBridgeSettingTab`, `imageTab.test.ts`, `settingsTab.ts`, `settings.ts`, `settingsTab.test.ts`, `sidebarView.test.ts`, `textTab.test.ts`, `main.test.ts`, `sidebarView.ts`, `addImage.ts`, `quickCapture.ts`, `profilesSection.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `ProviderError` connect `src/types.ts` to `imageTab.test.ts`, `settings.ts`, `sidebarView.ts`, `textProviderSection.test.ts`, `addImage.ts`, `comfyWorkflow.ts`, `modelLists.ts`, `imageProviderSection.test.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `AnkiBridgeSettings` connect `main.ts` to `imageTab.test.ts`, `settingsTab.ts`, `settings.ts`, `settingsTab.test.ts`, `sidebarView.test.ts`, `textTab.test.ts`, `textProviderSection.test.ts`, `addImage.ts`, `quickCapture.ts`, `imageProviderSection.test.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `$schema`, `.opencode/plugins/graphify.js`, `id` to the rest of the system?**
  _264 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `graphify Skill (/graphify)` be split into smaller, more focused modules?**
  _Cohesion score 0.10541310541310542 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._