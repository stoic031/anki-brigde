# Graph Report - anki-bridge  (2026-08-18)

## Corpus Check
<<<<<<< HEAD
- 62 files · ~39,605 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 369 nodes · 403 edges · 76 communities (19 shown, 57 thin omitted)
=======
- 63 files · ~40,096 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 373 nodes · 419 edges · 76 communities (19 shown, 57 thin omitted)
>>>>>>> origin/features/19-sync-delete-button-actions
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
<<<<<<< HEAD
- Built from commit: `9a82aa16`
=======
- Built from commit: `b7054a3f`
>>>>>>> origin/features/19-sync-delete-button-actions
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Generate with AI Button
- graphify Skill (/graphify)
- devDependencies
- compilerOptions
- Scenario 1: Create Note via Icon/Command
- types.ts
- Common Provider Interface (processText/generateAudio/generateImage)
- package.json
- Graphify Full Pipeline
- docs/contracts.md
- manifest.json
- Milestone 1: Core Sync + Settings
- docs/design/01-sync.md
- MediaResult interface
- controlsBlock.ts
- TextProvider interface
- graphify.js
- mediaNaming.ts
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

## God Nodes (most connected - your core abstractions)
1. `Common Provider Interface (processText/generateAudio/generateImage)` - 20 edges
2. `graphify Skill (/graphify)` - 17 edges
3. `compilerOptions` - 16 edges
4. `AnkiConnectClient` - 14 edges
5. `syncNote()` - 13 edges
6. `Graphify Full Pipeline` - 9 edges
7. `Generate with AI Button` - 9 edges
8. `Tab 1 — Note (Deck/Model/Folder/Field checkboxes)` - 9 edges
9. `scripts` - 8 edges
10. `Create Note From Selection (Hotkey / Quick Capture)` - 8 edges

## Surprising Connections (you probably didn't know these)
- `graphify Skill (/graphify)` --references--> `GitHub Clone & Cross-Repo Merge`  [EXTRACTED]
  .opencode/skills/graphify/SKILL.md → .claude/skills/graphify/references/github-and-merge.md
- `graphify Skill (/graphify)` --references--> `Post-Commit Auto-Rebuild Hook`  [EXTRACTED]
  .opencode/skills/graphify/SKILL.md → .claude/skills/graphify/references/hooks.md
- `AGENTS.md Non-Negotiables (9 rules)` --rationale_for--> `MediaResult interface`  [INFERRED]
  AGENTS.md → docs/contracts.md
- `Q12: Playwright-for-Obsidian proposal (use Vitest instead)` --references--> `Definition of Done (lint + type-check + test:unit)`  [INFERRED]
  docs/design-open-questions.md → AGENTS.md
- `Scenario 1: Create Note via Icon/Command` --semantically_similar_to--> `Branch B — First-Time Setup Modal`  [INFERRED] [semantically similar]
  docs/design/scenarios.md → docs/design/07-sidebar.md

## Import Cycles
- None detected.

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

## Communities (76 total, 57 thin omitted)

### Community 0 - "Generate with AI Button"
Cohesion: 0.11
Nodes (34): generateAudio(), generateImage(), processText(), targetFields (processText input), TextResult (processText output), Add Audio Button, Add Image Button, AI Buttons Never Write To Anki Directly (Sync-only) Principle (+26 more)

### Community 1 - "graphify Skill (/graphify)"
Cohesion: 0.11
Nodes (27): GitHub Clone & Cross-Repo Merge, Post-Commit Auto-Rebuild Hook, AGENTS.md graphify Integration Rules, /graphify add <url>, --watch (auto-rebuild watcher), Token reduction benchmark, FalkorDB export (--falkordb/--falkordb-push), MCP stdio server (--mcp) (+19 more)

### Community 2 - "devDependencies"
Cohesion: 0.08
Nodes (25): esbuild, eslint, @eslint/js, eslint-plugin-obsidianmd, globals, jiti, obsidian, devDependencies (+17 more)

### Community 3 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, ES2021, src/**/*.ts, compilerOptions, allowSyntheticDefaultImports, forceConsistentCasingInFileNames, inlineSourceMap, inlineSources (+12 more)

### Community 4 - "Scenario 1: Create Note via Icon/Command"
Cohesion: 0.13
Nodes (18): Repo Layout (src/ module organization), AnkiFrontmatter interface, FIELD_ALIASES map, Field Mapping Algorithm (3-pass deterministic), ParsedNote interface, Dynamic Field Mapping (§1.5), AI Provider Manager, anki-controls Markdown Code Block (+10 more)

### Community 5 - "types.ts"
Cohesion: 0.06
Nodes (29): AnkiConnectClient, AnkiConnectResponse, { requestUrl }, mapContentToFields(), stringifySectionValue(), extractSectionValue(), parseSections(), file (+21 more)

### Community 6 - "Common Provider Interface (processText/generateAudio/generateImage)"
Cohesion: 0.12
Nodes (17): Provider Abstraction Layer, Automatic1111 (Image, Local), Azure Speech (Audio, Cloud), Claude (Text, Cloud), ComfyUI (Image, Local), DALL-E 3 (Image, Cloud), Edge TTS (Audio, Cloud, free), ElevenLabs (Audio, Cloud) (+9 more)

### Community 7 - "package.json"
Cohesion: 0.12
Nodes (15): description, keywords, license, main, name, scripts, build, dev (+7 more)

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

### Community 14 - "controlsBlock.ts"
<<<<<<< HEAD
Cohesion: 0.12
Nodes (12): plugin, $schema, .opencode/plugins/graphify.js, AnkiBridgePlugin, ALWAYS_VISIBLE_BUTTONS, ControlAction, ControlButtonSpec, DELETE_BUTTON (+4 more)
=======
Cohesion: 0.11
Nodes (19): plugin, $schema, .opencode/plugins/graphify.js, AnkiBridgePlugin, ALWAYS_VISIBLE_BUTTONS, ControlAction, ControlButtonSpec, DELETE_BUTTON (+11 more)
>>>>>>> origin/features/19-sync-delete-button-actions

### Community 16 - "TextProvider interface"
Cohesion: 0.67
Nodes (3): TextProvider interface, TextResult interface, TextTask type

## Knowledge Gaps
<<<<<<< HEAD
- **153 isolated node(s):** `$schema`, `.opencode/plugins/graphify.js`, `id`, `name`, `version` (+148 more)
=======
- **154 isolated node(s):** `$schema`, `.opencode/plugins/graphify.js`, `id`, `name`, `version` (+149 more)
>>>>>>> origin/features/19-sync-delete-button-actions
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Common Provider Interface (processText/generateAudio/generateImage)` connect `Common Provider Interface (processText/generateAudio/generateImage)` to `Generate with AI Button`, `Scenario 1: Create Note via Icon/Command`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `AnkiConnectClient` connect `types.ts` to `controlsBlock.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `$schema`, `.opencode/plugins/graphify.js`, `id` to the rest of the system?**
<<<<<<< HEAD
  _153 weakly-connected nodes found - possible documentation gaps or missing edges._
=======
  _154 weakly-connected nodes found - possible documentation gaps or missing edges._
>>>>>>> origin/features/19-sync-delete-button-actions
- **Should `Generate with AI Button` be split into smaller, more focused modules?**
  _Cohesion score 0.11229946524064172 - nodes in this community are weakly interconnected._
- **Should `graphify Skill (/graphify)` be split into smaller, more focused modules?**
  _Cohesion score 0.10541310541310542 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._