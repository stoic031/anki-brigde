# Graph Report - .  (2026-08-05)

## Corpus Check
- 5 files · ~35,181 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 311 nodes · 292 edges · 76 communities (19 shown, 57 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.86)
- Token cost: 103,136 input · 0 output

## Community Hubs (Navigation)
- AI Provider Call Signatures (processText/generateAudio/generateImage)
- graphify Advanced Exports & Add/Watch (.claude copy)
- ESLint Toolchain Config
- TypeScript Compiler Config
- Field Mapping & Note Parsing
- Shared Type Contracts (types.ts)
- Provider Abstraction Layer & Named Providers
- package.json Metadata
- graphify Skill Reference Docs (.opencode copy)
- Add-AI-Provider Skill Procedure
- manifest.json Plugin Metadata
- Design Doc Module Index & Roadmap Milestones
- Sync & Note Content Rules
- Provider Interfaces & Non-Negotiables
- opencode.json Plugin Config
- main.ts Plugin Lifecycle
- Text Provider Contract (TextProvider/TextResult/TextTask)
- graphify.js opencode Plugin
- Media Filename Sanitization
- Version Bump Script
- Graph Shrink Guard (#479)
- Incremental Update Manifest Stamping
- CI Workflows (Build & Release)
- Definition of Done vs Playwright Rejection
- AnkiConnect Error Handling
- Media Filename Format & Sanitization Rule
- No-Vault-Media Principle & Naming Convention
- Module Numbering Gap (3→5) Note
- Local AI Providers Non-Negotiable
- No Hardcoded API Keys Rule
- Provider Unit Test Requirement
- Provider Text Output Validation
- AnkiConnectClient
- Content Update Append Rule
- Listener Cleanup Rule
- Long Operation Feedback
- Shared Settings State Rule
- Themed Styling Rule
- graphify add URL Ingestion
- graphify --watch Mode
- graphify Token Reduction Benchmark
- graphify MCP Server
- graphify Neo4j/FalkorDB Export
- Calls Edge Direction Rule
- Confidence Score Rubric
- Hyperedge Usage Guidance
- Node ID Format Rule
- Semantic Similarity Edge Guidance
- Monorepo Multi-Subfolder Merge
- graphify BFS vs DFS Traversal
- graphify save-result Feedback Loop
- graphify Query Vocab Expansion
- Whisper Transcription Prompt
- graphify --cluster-only Rerun
- AST vs Semantic Extraction Split
- graphify Query Fast Path
- graphify Post-Pipeline Guide Behavior
- graphify Graph Health Check
- graphify Honesty Rules
- graphify Usage Rules (CLAUDE.md)
- CLAUDE.md Claude Code Specifics
- Plan-Mode-Required Paths
- ProviderError Class
- Sync Data Flow (§1.3)
- One-Way Sync Constraint
- Content Parsing Logic (Heading-Based)
- Delete Button (Note Controls)
- Toast Notifications (§5.2)
- Button Visual Feedback States (§5.1)
- AnkiConnect Connect-Button Flow (§6.1)
- Design Doc Translation Open Question
- roadmap.md Development Roadmap
- Obsidian Sample Plugin README

## God Nodes (most connected - your core abstractions)
1. `Common Provider Interface (processText/generateAudio/generateImage)` - 20 edges
2. `graphify Skill (/graphify)` - 17 edges
3. `compilerOptions` - 15 edges
4. `Graphify Full Pipeline` - 9 edges
5. `Generate with AI Button` - 9 edges
6. `Tab 1 — Note (Deck/Model/Folder/Field checkboxes)` - 9 edges
7. `scripts` - 8 edges
8. `Create Note From Selection (Hotkey / Quick Capture)` - 8 edges
9. `Scenario 2: Create Note From Selected Text (Hotkey)` - 8 edges
10. `Add Audio Button` - 7 edges

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

### Community 0 - "AI Provider Call Signatures (processText/generateAudio/generateImage)"
Cohesion: 0.11
Nodes (34): generateAudio(), generateImage(), processText(), targetFields (processText input), TextResult (processText output), Add Audio Button, Add Image Button, AI Buttons Never Write To Anki Directly (Sync-only) Principle (+26 more)

### Community 1 - "graphify Advanced Exports & Add/Watch (.claude copy)"
Cohesion: 0.11
Nodes (27): GitHub Clone & Cross-Repo Merge, Post-Commit Auto-Rebuild Hook, AGENTS.md graphify Integration Rules, /graphify add <url>, --watch (auto-rebuild watcher), Token reduction benchmark, FalkorDB export (--falkordb/--falkordb-push), MCP stdio server (--mcp) (+19 more)

### Community 2 - "ESLint Toolchain Config"
Cohesion: 0.08
Nodes (25): esbuild, eslint, @eslint/js, eslint-plugin-obsidianmd, globals, jiti, obsidian, devDependencies (+17 more)

### Community 3 - "TypeScript Compiler Config"
Cohesion: 0.10
Nodes (19): DOM, ES2021, src/**/*.ts, compilerOptions, allowSyntheticDefaultImports, forceConsistentCasingInFileNames, inlineSourceMap, inlineSources (+11 more)

### Community 4 - "Field Mapping & Note Parsing"
Cohesion: 0.13
Nodes (18): Repo Layout (src/ module organization), AnkiFrontmatter interface, FIELD_ALIASES map, Field Mapping Algorithm (3-pass deterministic), ParsedNote interface, Dynamic Field Mapping (§1.5), AI Provider Manager, anki-controls Markdown Code Block (+10 more)

### Community 5 - "Shared Type Contracts (types.ts)"
Cohesion: 0.11
Nodes (12): AnkiConnectError, AnkiFrontmatter, AudioOptions, AudioProvider, ImageOptions, ImageProvider, MediaResult, ParsedNote (+4 more)

### Community 6 - "Provider Abstraction Layer & Named Providers"
Cohesion: 0.12
Nodes (17): Provider Abstraction Layer, Automatic1111 (Image, Local), Azure Speech (Audio, Cloud), Claude (Text, Cloud), ComfyUI (Image, Local), DALL-E 3 (Image, Cloud), Edge TTS (Audio, Cloud, free), ElevenLabs (Audio, Cloud) (+9 more)

### Community 7 - "package.json Metadata"
Cohesion: 0.12
Nodes (15): description, keywords, license, main, name, scripts, build, dev (+7 more)

### Community 8 - "graphify Skill Reference Docs (.opencode copy)"
Cohesion: 0.15
Nodes (13): Graphify-First Directive, Add URL & Watch Folder Reference, Extra Exports & Benchmark Reference, Extraction Subagent Prompt Template, GitHub Clone & Merge Reference, Native CLAUDE.md Integration, Commit Hook & CLAUDE.md Integration Reference, Query/Path/Explain Reference (+5 more)

### Community 9 - "Add-AI-Provider Skill Procedure"
Cohesion: 0.22
Nodes (11): Provider Adapter Pattern, Normalize At Adapter Boundary, Media Filename Format, Copy Style Rules, Add AI Provider Checklist, Add Provider Pre-Check, docs/contracts.md, docs/design/02-providers.md (+3 more)

### Community 10 - "manifest.json Plugin Metadata"
Cohesion: 0.20
Nodes (9): author, authorUrl, description, fundingUrl, id, isDesktopOnly, minAppVersion, name (+1 more)

### Community 11 - "Design Doc Module Index & Roadmap Milestones"
Cohesion: 0.29
Nodes (7): Module 1: Core Sync Engine, Module 5: UI/UX, Module 6: Settings Tab (Connection Flow), Milestone 1: Core Sync + Settings, Milestone 2: Sidebar Modal + Dynamic Fields, Milestone 3: AI Integration, Milestone 4: Polish & UX

### Community 12 - "Sync & Note Content Rules"
Cohesion: 0.33
Nodes (6): Heading-Based Content Parsing, Sync Error Path Coverage, Idempotent Sync Rule, Button State Cycle, docs/design/01-sync.md, docs/design/03-note.md

### Community 13 - "Provider Interfaces & Non-Negotiables"
Cohesion: 0.50
Nodes (5): AGENTS.md Non-Negotiables (9 rules), AudioProvider interface, ImageProvider interface, MediaResult interface, Q14: AudioOptions/ImageOptions shape undefined

### Community 14 - "opencode.json Plugin Config"
Cohesion: 0.50
Nodes (3): plugin, $schema, .opencode/plugins/graphify.js

### Community 16 - "Text Provider Contract (TextProvider/TextResult/TextTask)"
Cohesion: 0.67
Nodes (3): TextProvider interface, TextResult interface, TextTask type

## Knowledge Gaps
- **141 isolated node(s):** `$schema`, `.opencode/plugins/graphify.js`, `id`, `name`, `version` (+136 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Common Provider Interface (processText/generateAudio/generateImage)` connect `Provider Abstraction Layer & Named Providers` to `AI Provider Call Signatures (processText/generateAudio/generateImage)`, `Field Mapping & Note Parsing`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `ESLint Toolchain Config` to `package.json Metadata`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `Scenario 1: Create Note via Icon/Command` connect `Field Mapping & Note Parsing` to `AI Provider Call Signatures (processText/generateAudio/generateImage)`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `.opencode/plugins/graphify.js`, `id` to the rest of the system?**
  _141 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AI Provider Call Signatures (processText/generateAudio/generateImage)` be split into smaller, more focused modules?**
  _Cohesion score 0.11229946524064172 - nodes in this community are weakly interconnected._
- **Should `graphify Advanced Exports & Add/Watch (.claude copy)` be split into smaller, more focused modules?**
  _Cohesion score 0.10541310541310542 - nodes in this community are weakly interconnected._
- **Should `ESLint Toolchain Config` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._