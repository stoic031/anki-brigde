# Graph Report - anki-bridge  (2026-09-23)

## Corpus Check
- 143 files · ~87,927 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1083 nodes · 1939 edges · 120 communities (48 shown, 72 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `acaafc64`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Create Note From Selection (Hotkey / Quick Capture)
- graphify Skill (/graphify)
- devDependencies
- compilerOptions
- Field Mapping Algorithm (3-pass deterministic)
- syncEngine.ts
- noteNameModal.test.ts
- AnkiConnectClient
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
- FakeEl
- sidebarView.ts
- src/types.ts
- textProviderSection.test.ts
- generateFields.ts
- providerEditor.ts
- Generate with AI Button
- quickCapture.ts
- addImage.ts
- SidebarView
- imageProviderSection.test.ts
- autoSync.test.ts
- FakeSetting
- Scenario 1: Create Note via Icon/Command
- textTab.test.ts
- FakeText
- Sidebar Modal (Right Sidebar View Panel)
- fakeDom.ts
- FakeButton
- FakeDropdown
- FakeEl
- addImage.test.ts
- noteActions.test.ts
- startProgressNotice
- FakeSecret
- FakeArea
- main.ts
- FakeDropdownComponent
- AnkiBridgePlugin
- FakeSetting
- FakeButtonComponent
- createNote.test.ts
- plugin
- FakeSetting
- FakeTextComponent
- FakeToggleComponent
- ItemView

## God Nodes (most connected - your core abstractions)
1. `AnkiBridgePlugin` - 40 edges
2. `AnkiConnectClient` - 24 edges
3. `ProviderError` - 24 edges
4. `resolveAnkiConnectUrl()` - 23 edges
5. `SidebarView` - 22 edges
6. `AnkiBridgeSettings` - 20 edges
7. `fieldConfigKey()` - 20 edges
8. `Common Provider Interface (processText/generateAudio/generateImage)` - 20 edges
9. `FakeEl` - 19 edges
10. `toastError()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `loadSettings()` --references--> `plugin`  [EXTRACTED]
  src/settings.ts → .opencode/opencode.json
- `saveSettings()` --references--> `plugin`  [EXTRACTED]
  src/settings.ts → .opencode/opencode.json
- `graphify Skill (/graphify)` --references--> `GitHub Clone & Cross-Repo Merge`  [EXTRACTED]
  .opencode/skills/graphify/SKILL.md → .claude/skills/graphify/references/github-and-merge.md
- `graphify Skill (/graphify)` --references--> `Post-Commit Auto-Rebuild Hook`  [EXTRACTED]
  .opencode/skills/graphify/SKILL.md → .claude/skills/graphify/references/hooks.md
- `AGENTS.md Non-Negotiables (9 rules)` --rationale_for--> `MediaResult interface`  [INFERRED]
  AGENTS.md → docs/contracts.md

## Import Cycles
- 3-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/noteActions.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/imageProviderSection.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/mediaSection.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/profilesSection.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/syncSection.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/textProviderSection.ts -> src/main.ts`
- 3-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/textTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/createNote.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/quickCapture.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/note/addImage.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/createNote.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/noteActions.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/quickCapture.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/noteActions.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/createNote.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/textTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/note/quickCapture.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/textTab.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/imageProviderSection.ts -> src/ui/providerSection.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/ui/settingsTab.ts -> src/ui/textProviderSection.ts -> src/ui/providerSection.ts -> src/main.ts`
- 4-file cycle: `src/main.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/textTab.ts -> src/note/generateFields.ts -> src/main.ts`
- 5-file cycle: `src/main.ts -> src/note/createNote.ts -> src/note/quickCapture.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/main.ts`
- 5-file cycle: `src/main.ts -> src/note/createNote.ts -> src/ui/sidebarView.ts -> src/ui/sidebar/imageTab.ts -> src/note/addImage.ts -> src/main.ts`

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

## Communities (120 total, 72 thin omitted)

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

### Community 5 - "syncEngine.ts"
Cohesion: 0.25
Nodes (13): registerAutoSync(), trigger(), extractSectionValue(), parseSections(), readAnkiFrontmatter(), file, writeAnkiFrontmatter(), createNote() (+5 more)

### Community 6 - "noteNameModal.test.ts"
Cohesion: 0.09
Nodes (6): NoteNameModal, FakeButtonComponent, FakeSetting, FakeTextComponent, openModal(), { settings, modalState }

### Community 7 - "AnkiConnectClient"
Cohesion: 0.11
Nodes (6): AnkiConnectClient, AnkiConnectResponse, { requestUrl }, FIELDS, file, AnkiConnectError

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
Cohesion: 0.12
Nodes (9): FakeDropdown, FakeSetting, { modelFieldNames, AnkiConnectClient }, note, { Notice, setIcon, settings }, { planAddImage, runAddImage }, ready(), setup() (+1 more)

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
Cohesion: 0.13
Nodes (15): Case, { deckModelWarningOpen, deckModelWarningCapture }, { deckNamesMock, modelNamesMock, AnkiConnectClient }, fakeApp(), fakePlugin(), fakeSettings(), fakeTFile(), { noteActionsUpdate, textTabSync, imageTabSync } (+7 more)

### Community 79 - "[1.1.0]"
Cohesion: 0.12
Nodes (15): [1.0.0], [1.1.0], Added, Added, Added, Changed, Changed, Changelog (+7 more)

### Community 80 - "settings.ts"
Cohesion: 0.16
Nodes (20): ImageProviderId, ProviderPreset, TextProviderId, DEFAULT_PROFILE, endpointUrl(), getActiveImageConfig(), getActiveTextConfig(), ImageProviderConfig (+12 more)

### Community 81 - "confirmRebuildFields.test.ts"
Cohesion: 0.12
Nodes (5): ConfirmRebuildFieldsModal, FakeButtonComponent, FakeSetting, openModal(), { settings, modalState }

### Community 82 - "confirmDelete.test.ts"
Cohesion: 0.12
Nodes (5): ConfirmDeleteModal, FakeButtonComponent, FakeSetting, openModal(), { settings, modalState }

### Community 84 - "sidebarView.ts"
Cohesion: 0.22
Nodes (16): runAddImage(), generateDraft(), resolveAnkiConnectUrl(), ActionButton, createActionButton(), runAction(), ImageTab, renderImageTab() (+8 more)

### Community 85 - "src/types.ts"
Cohesion: 0.08
Nodes (37): Cached, Factory, normalizeErrors(), ProviderConfig, ProviderKind, ProviderManager, ProviderManagerOptions, makeManager() (+29 more)

### Community 86 - "textProviderSection.test.ts"
Cohesion: 0.04
Nodes (13): clearModelCache(), cloud, FakeButton, FakeDropdown, FakeEl, FakeSecret, FakeSetting, FakeText (+5 more)

### Community 87 - "generateFields.ts"
Cohesion: 0.19
Nodes (13): AiButtonAction, AiPreCheckResult, runAiPreCheck(), applyGenerated(), GenerateOutcome, GeneratePlan, planGenerate(), { modelFieldNames } (+5 more)

### Community 88 - "providerEditor.ts"
Cohesion: 0.06
Nodes (56): analyzeWorkflow(), describeAnalysis(), fetchWorkflow(), fromApiFormat(), fromUiFormat(), get(), Graph, listWorkflows() (+48 more)

### Community 89 - "Generate with AI Button"
Cohesion: 0.23
Nodes (12): processText(), targetFields (processText input), TextResult (processText output), Auto-generate Content Structure, Generate with AI Button, Connection Status + Test Connection, Deck Dropdown, Field Checkboxes (Generate with AI) (+4 more)

### Community 90 - "quickCapture.ts"
Cohesion: 0.13
Nodes (22): generateContentSkeleton(), rebuildContent(), runCreateNote(), buildMediaFilename(), sanitizeForFilename(), AppWithSettingTab, getQuickCaptureFilename(), getSelectedText() (+14 more)

### Community 91 - "addImage.ts"
Cohesion: 0.28
Nodes (10): AddImageOutcome, AddImagePlan, planAddImage(), sectionText(), applyImageTag(), ImageTagMode, fillEmptySections(), FillResult (+2 more)

### Community 93 - "imageProviderSection.test.ts"
Cohesion: 0.17
Nodes (8): clearWorkflowCache(), renderImageProviderSection(), auto, { listModels }, { listWorkflows, fetchWorkflow }, { Notice, rendered, secrets }, openai, setup()

### Community 94 - "autoSync.test.ts"
Cohesion: 0.25
Nodes (5): { AnkiConnectClient }, configured, { readAnkiFrontmatter }, { syncNote }, { toastSuccess, toastError }

### Community 96 - "Scenario 1: Create Note via Icon/Command"
Cohesion: 0.32
Nodes (8): Branch A — Deck/Model Already Configured, Branch B — First-Time Setup Modal, Action: Create New Note (2-branch), Command: "Anki: Create new note" (id create-note), Ribbon Icon (create note + open modal), Scenario 1: Create Note via Icon/Command, Scenario 4: Change Deck/Model For Already-Synced Note, Warning Only Applies To Already-Synced Notes

### Community 97 - "textTab.test.ts"
Cohesion: 0.07
Nodes (13): FakeDropdown, FakeExtraButton, FakeSetting, FakeTextArea, flush(), { modelFieldNames, AnkiConnectClient }, note, { Notice, setIcon, settings } (+5 more)

### Community 99 - "Sidebar Modal (Right Sidebar View Panel)"
Cohesion: 0.29
Nodes (7): AI Provider Manager, AI Buttons Never Write To Anki Directly (Sync-only) Principle, anki-controls Markdown Code Block, Sync Button, Command: "Anki: Open Deck & Model Selector", Sidebar Modal (Right Sidebar View Panel), Design Doc Architecture Overview

### Community 100 - "fakeDom.ts"
Cohesion: 0.32
Nodes (5): CreateOpts, renderTabs(), Tab, render(), tabs

### Community 104 - "addImage.test.ts"
Cohesion: 0.29
Nodes (6): imageProvider, { modelFieldNames, storeMediaFile }, note, setup(), textProvider, ImageFieldConfig

### Community 105 - "noteActions.test.ts"
Cohesion: 0.15
Nodes (10): SyncError, ActionState, { deleteModal, rebuildModal }, { modelFieldNames, AnkiConnectClient }, note, process, { setIcon }, setup() (+2 more)

### Community 106 - "startProgressNotice"
Cohesion: 0.32
Nodes (4): ProgressNotice, startProgressNotice(), { Notice, notices }, withElapsed()

### Community 109 - "main.ts"
Cohesion: 0.31
Nodes (3): DEFAULT_SETTINGS, { Notice, settings }, FIELD_ALIASES

### Community 111 - "AnkiBridgePlugin"
Cohesion: 0.06
Nodes (31): AnkiBridgePlugin, { loadSettings, saveSettings, getActiveTextConfig, getActiveImageConfig }, { PluginBase, addCommandSpy }, { registerAutoSync }, { registerSidebarView, revealSidebarView }, { runCreateNote }, { runQuickCapture }, getActiveProfile() (+23 more)

### Community 114 - "createNote.test.ts"
Cohesion: 0.22
Nodes (9): fakePlugin(), fakeSettings(), { modelFieldNamesMock, AnkiConnectClient }, { NoteNameModal, submitNoteName, resetCapturedSubmit }, { Notice }, { resolveQuickCaptureTarget, getUniqueNotePath, openPluginSettings }, { revealSidebarView }, { toastError } (+1 more)

### Community 115 - "plugin"
Cohesion: 0.50
Nodes (3): plugin, $schema, .opencode/plugins/graphify.js

## Knowledge Gaps
- **274 isolated node(s):** `$schema`, `.opencode/plugins/graphify.js`, `id`, `name`, `version` (+269 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **72 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AnkiBridgePlugin` connect `AnkiBridgePlugin` to `textTab.test.ts`, `syncEngine.ts`, `addImage.test.ts`, `noteActions.test.ts`, `main.ts`, `imageTab.test.ts`, `settingsTab.test.ts`, `sidebarView.test.ts`, `createNote.test.ts`, `sidebarView.ts`, `generateFields.ts`, `providerEditor.ts`, `quickCapture.ts`, `addImage.ts`, `autoSync.test.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `AnkiBridgeSettings` connect `generateFields.ts` to `textTab.test.ts`, `main.ts`, `imageTab.test.ts`, `AnkiBridgePlugin`, `settings.ts`, `settingsTab.test.ts`, `createNote.test.ts`, `sidebarView.test.ts`, `textProviderSection.test.ts`, `providerEditor.ts`, `quickCapture.ts`, `imageProviderSection.test.ts`, `autoSync.test.ts`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `AnkiConnectClient` connect `AnkiConnectClient` to `syncEngine.ts`, `AnkiBridgePlugin`, `sidebarView.ts`, `generateFields.ts`, `quickCapture.ts`, `addImage.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `$schema`, `.opencode/plugins/graphify.js`, `id` to the rest of the system?**
  _274 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `graphify Skill (/graphify)` be split into smaller, more focused modules?**
  _Cohesion score 0.10541310541310542 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._