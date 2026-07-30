# Graph Report - .  (2026-07-30)

## Corpus Check
- Corpus is ~21,524 words - fits in a single context window. You may not need a graph.

## Summary
- 216 nodes · 168 edges · 70 communities (13 shown, 57 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.84)
- Token cost: 215,690 input · 0 output

## Community Hubs (Navigation)
- Plugin Architecture & Contracts
- Build & Lint Tooling
- TypeScript Compiler Config
- Plugin Lifecycle (main.ts)
- Graphify Skill Reference Docs
- Package Manifest (package.json)
- AI Provider Adapter Rules
- Obsidian Plugin Manifest
- Note Controls & Media Naming
- Sync Engine Design Rules
- Field Mapping Algorithm
- Version Bump Script
- Graph Shrink Guard Safety
- Incremental Update Flow
- CI Workflows
- Sync Error Handling
- Add Audio Button Flow
- Local AI Providers
- No Hardcoded API Keys
- Provider Test Requirement
- Provider Output Validation
- AnkiConnect Client
- Content Append Rule
- Listener Cleanup Rule
- Long Operation Feedback
- Shared Settings State
- Themed Styling Rule
- URL Ingestion (add)
- Watch Mode
- Token Reduction Benchmark
- MCP Server Export
- Graph DB Export
- Call Edge Direction Rule
- Confidence Score Rubric
- Hyperedge Usage Guidance
- Node ID Format Rule
- Semantic Similarity Guidance
- Cross-Repo Merge
- Monorepo Merge
- Auto-Rebuild Hook
- Query Traversal Modes
- Query Feedback Loop
- Query Vocabulary Expansion
- Whisper Transcription
- Cluster-Only Rerun
- AST/Semantic Split
- Query Fast Path
- Post-Pipeline Guide
- Graph Health Check
- Honesty Rules
- Definition of Done
- Non-Negotiable Rules
- Graphify Usage Rules
- Plan-Mode Gated Paths
- AnkiFrontmatter Interface
- MediaResult Interface
- ParsedNote Interface
- ProviderError Class
- Sync Data Flow
- Provider Manager Lifecycle
- Add Image Button
- Delete Button
- Sync Button
- Toast Notifications
- Button Feedback States
- AnkiConnect Connect Flow
- Open Question: Acceptance Criteria
- README Boilerplate

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `docs/design/README.md — architecture overview & module index` - 12 edges
3. `MyPlugin` - 9 edges
4. `Graphify Full Pipeline` - 9 edges
5. `Create note from selection / hotkey quick-capture (§3.7)` - 6 edges
6. `scripts` - 5 edges
7. `SampleSettingTab` - 5 edges
8. `docs/contracts.md` - 5 edges
9. `AGENTS.md — Agent Guide (Obsidian-Anki AI Plugin)` - 5 edges
10. `Module 2: AI Provider Manager` - 5 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md — Claude Code specifics` --references--> `AGENTS.md — Agent Guide (Obsidian-Anki AI Plugin)`  [EXTRACTED]
  CLAUDE.md → AGENTS.md
- `Q12: Playwright for Obsidian — rejected in favor of Vitest + manual checklist` --references--> `AGENTS.md — Agent Guide (Obsidian-Anki AI Plugin)`  [EXTRACTED]
  docs/design-open-questions.md → AGENTS.md
- `CLAUDE.md — Claude Code specifics` --references--> `docs/design/README.md — architecture overview & module index`  [EXTRACTED]
  CLAUDE.md → docs/design/README.md
- `Graph Shrink Guard (#479)` --semantically_similar_to--> `build_merge Direct Graph Read`  [INFERRED] [semantically similar]
  .claude/skills/graphify/SKILL.md → .claude/skills/graphify/references/update.md
- `AGENTS.md — Agent Guide (Obsidian-Anki AI Plugin)` --references--> `contracts.md — machine-readable types & algorithms`  [EXTRACTED]
  AGENTS.md → docs/contracts.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Conditional Reference-Doc Architecture** — _claude_skills_graphify_skill_pipeline, _claude_skills_graphify_references_add_watch_overview, _claude_skills_graphify_references_github_and_merge_overview, _claude_skills_graphify_references_update_overview, _claude_skills_graphify_references_query_overview, _claude_skills_graphify_references_hooks_overview, _claude_skills_graphify_references_exports_overview, _claude_skills_graphify_references_transcribe_overview, _claude_skills_graphify_references_extraction_spec_subagent_prompt [EXTRACTED 1.00]
- **Add-Provider Governance Flow (Rule + Skill + Spec)** — _claude_rules_providers_adapter_pattern, _claude_skills_add_ai_provider_skill_checklist, docs_design_02_providers_spec, docs_contracts_interfaces [INFERRED 0.85]
- **Graph Integrity Safeguards Across the Pipeline** — _claude_skills_graphify_skill_shrink_guard, _claude_skills_graphify_skill_manifest_stamping, _claude_skills_graphify_references_update_build_merge, _claude_skills_graphify_references_update_cluster_only [INFERRED 0.85]
- **Three AI-driven note-control buttons sharing 'never call updateNoteFields directly' principle** — docs_design_03_note_generate_ai_button, docs_design_03_note_add_audio_button, docs_design_03_note_add_image_button [EXTRACTED 1.00]
- **Three parallel AI provider interfaces (TextProvider/AudioProvider/ImageProvider) implementing the same id/isCloud abstraction pattern** — docs_contracts_textprovider, docs_contracts_audioprovider, docs_contracts_imageprovider [EXTRACTED 1.00]
- **Four sequential development milestones forming the project roadmap** — docs_design_roadmap_milestone1, docs_design_roadmap_milestone2, docs_design_roadmap_milestone3, docs_design_roadmap_milestone4 [INFERRED 0.85]

## Communities (70 total, 57 thin omitted)

### Community 0 - "Plugin Architecture & Contracts"
Cohesion: 0.10
Nodes (28): AGENTS.md — Agent Guide (Obsidian-Anki AI Plugin), CLAUDE.md — Claude Code specifics, AudioProvider interface, ImageProvider interface, contracts.md — machine-readable types & algorithms, TextProvider interface, TextResult interface, One-way sync only, no conflict resolution at M1-2 (+20 more)

### Community 1 - "Build & Lint Tooling"
Cohesion: 0.10
Nodes (21): esbuild, eslint, @eslint/js, eslint-plugin-obsidianmd, globals, jiti, obsidian, devDependencies (+13 more)

### Community 2 - "TypeScript Compiler Config"
Cohesion: 0.10
Nodes (19): DOM, ES2021, src/**/*.ts, compilerOptions, allowSyntheticDefaultImports, forceConsistentCasingInFileNames, inlineSourceMap, inlineSources (+11 more)

### Community 3 - "Plugin Lifecycle (main.ts)"
Cohesion: 0.22
Nodes (5): MyPlugin, SampleModal, DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab

### Community 4 - "Graphify Skill Reference Docs"
Cohesion: 0.15
Nodes (13): Graphify-First Directive, Add URL & Watch Folder Reference, Extra Exports & Benchmark Reference, Extraction Subagent Prompt Template, GitHub Clone & Merge Reference, Native CLAUDE.md Integration, Commit Hook & CLAUDE.md Integration Reference, Query/Path/Explain Reference (+5 more)

### Community 5 - "Package Manifest (package.json)"
Cohesion: 0.15
Nodes (12): description, keywords, license, main, name, scripts, build, dev (+4 more)

### Community 6 - "AI Provider Adapter Rules"
Cohesion: 0.22
Nodes (11): Provider Adapter Pattern, Normalize At Adapter Boundary, Media Filename Format, Copy Style Rules, Add AI Provider Checklist, Add Provider Pre-Check, docs/contracts.md, docs/design/02-providers.md (+3 more)

### Community 7 - "Obsidian Plugin Manifest"
Cohesion: 0.20
Nodes (9): author, authorUrl, description, fundingUrl, id, isDesktopOnly, minAppVersion, name (+1 more)

### Community 8 - "Note Controls & Media Naming"
Cohesion: 0.22
Nodes (9): Media filename format {prefix}{word}_{type}_{timestamp}.{ext}, sanitizeForFilename() spec, Auto-generate content structure from Model fields (§3.6), Create note from selection / hotkey quick-capture (§3.7), Media file naming convention (§3.5), Sidebar Modal: Create New Note action (§7.3), Deck/Model selection persistence (§7.4), Scenario 1: Create note from Sidebar Modal (+1 more)

### Community 9 - "Sync Engine Design Rules"
Cohesion: 0.33
Nodes (6): Heading-Based Content Parsing, Sync Error Path Coverage, Idempotent Sync Rule, Button State Cycle, docs/design/01-sync.md, docs/design/03-note.md

### Community 10 - "Field Mapping Algorithm"
Cohesion: 0.50
Nodes (4): FIELD_ALIASES table, Deterministic field-mapping algorithm (Pass 1/2/3), What gets written into media fields (sound/img tags), Dynamic Field Mapping (§1.5)

## Knowledge Gaps
- **110 isolated node(s):** `id`, `name`, `version`, `minAppVersion`, `description` (+105 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Build & Lint Tooling` to `Package Manifest (package.json)`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `id`, `name`, `version` to the rest of the system?**
  _110 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Plugin Architecture & Contracts` be split into smaller, more focused modules?**
  _Cohesion score 0.09788359788359788 - nodes in this community are weakly interconnected._
- **Should `Build & Lint Tooling` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `TypeScript Compiler Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._