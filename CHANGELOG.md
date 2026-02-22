# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2025-01-XX

### Added
- Initial open source release
- BYO-key authentication (OpenAI, Anthropic)
- Full 3-panel interface (Nodes | Focus | Chat)
- Vector search with sqlite-vec
- Integrate workflow for connection discovery
- Content extraction (YouTube, PDF, web)
- Easy/Hard mode toggle (GPT vs Claude)
- MCP server for external AI assistants
- Local SQLite database with embeddings

### Notes
- macOS only for v0.1.0 (Linux/Windows support coming)
- Requires Node.js 18+ and native build tools for better-sqlite3

## 2026-02-22

**Outcome:** Completed full PKM migration from Obsidian to PKM5 SQLite across all 7 phases: 27 dimensions created, ~210 vault nodes migrated with 250 wiki-link edges, 20 slash commands rewritten for PKM5 MCP tools, Atlas memory guide ported, LLM routing (confidential → Maci Ollama) inlined into 3 skills, Paperless full pipeline built (35 nodes enriched with OCR), heartbeat rewritten as direct SQLite queries with launchd deployment, iOS/macOS shortcuts updated for PKM5 endpoints.
**Decision:** Heartbeat moved from Maci cron to MacBook launchd (PKM5 SQLite is local). Dashboard decommissioned (all workflows covered by PKM5 skills). Atlas-framework retired.
**Files:** scripts/paperless/ingest.py, scripts/heartbeat.py, scripts/install-heartbeat.sh, .claude/commands/*.md (20 files), .claude/guides/memory.md, docs/shortcuts/README.md, CLAUDE.md, scripts/migrate/import_pkm2026.ts
