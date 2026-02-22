# RA-H — Knowledge Management System

## What This Is

LLM-powered personal knowledge graph. Local SQLite, fully on-device. Replaces Obsidian PKM_2026 vault.

**Tech stack:** Next.js 15 + TypeScript + Tailwind CSS + SQLite + sqlite-vec

---

## Quick Start

```bash
cd "/Users/balazsfurjes/Cursor files/ra-h_os"
npm run dev          # http://localhost:3000
```

MCP server (for Claude Code integration):
```bash
node apps/mcp-server-standalone/index.js
```

Database: `~/Library/Application Support/RA-H/db/rah.sqlite`

---

## Domain System

14 active domains — every node carries at least one domain dimension:

```
admin, EIT Water, InnoStars, HAC26, BIO-RED, KillerCatch, MyBoards,
ClaimMore, InnoMap, family, health, hobby, AI_development, development
```

Entity types (every node carries exactly one):
```
task, project, meeting, commitment, person, org, clipping, idea
```

Status dimensions: `pending`, `active`, `complete`, `archived`

Full reference: `.claude/guides/pkm-dimensions.md`

---

## Available MCP Tools

All 14 tools via `ra-h-standalone` MCP server:

| Tool | Purpose |
|------|---------|
| `rah_add_node` | Create a node (title, content, dimensions, metadata) |
| `rah_search_nodes` | Keyword + semantic search with dimension filters |
| `rah_get_nodes` | Load nodes by ID |
| `rah_update_node` | Update node fields (title, content append, dimensions, metadata) |
| `rah_create_edge` | Create directed edge between nodes |
| `rah_update_edge` | Update edge explanation |
| `rah_query_edges` | Find edges for a node |
| `rah_list_dimensions` | List all dimensions |
| `rah_create_dimension` | Create a new dimension |
| `rah_update_dimension` | Update/rename a dimension |
| `rah_delete_dimension` | Delete a dimension |
| `rah_list_guides` | List available guides |
| `rah_read_guide` | Read a guide by name |
| `rah_write_guide` | Create/update a guide |
| `rah_search_content` | Search within node chunks |
| `rah_sqlite_query` | Execute read-only SQL queries |

---

## Slash Commands (PKM Skills)

All 20 skills in `.claude/commands/`. Invoke with `/skill-name [args]`.

### Planning & Capture
| Skill | Purpose |
|-------|---------|
| `/quick <text>` | Ultra-fast task capture → `rah_add_node` |
| `/new <text>` | Full entity creation with edges |
| `/dashboard [domain:X]` | Visual overview of pending work |
| `/pending [domain:X]` | List pending tasks by urgency |
| `/today [domain:X]` | Daily capacity plan + calendar |

### Meeting Workflow
| Skill | Purpose |
|-------|---------|
| `/meeting-prep [names or company]` | Load participant + org context |
| `/post-meeting` | Create meeting node + attendee edges |
| `/parse-clippings [domain:X]` | Process unread clippings, extract actions |

### Task Management
| Skill | Purpose |
|-------|---------|
| `/complete-task <title or id>` | Mark task complete |
| `/delegate to:<name> <task>` | Record delegated task |
| `/consolidate [actions/duplicates]` | Merge dupes, promote #action items |

### Reviews
| Skill | Purpose |
|-------|---------|
| `/daily-review` | Compare planned vs actual, update statuses |
| `/weekly-review [YYYY-WNN]` | Weekly theme + memory check |
| `/monthly-review [YYYY-MM]` | Monthly pattern synthesis |
| `/quarterly-review [YYYY-QN]` | Quarterly strategic review |

### Research & Documents
| Skill | Purpose |
|-------|---------|
| `/search-vault <query>` | Semantic search + confidentiality routing |
| `/doc [search/ingest/orphans]` | Paperless-ngx document search + ingest |
| `/distill [query/ids]` | Synthesise a set of nodes into insights |

### Cards & Entity Management
| Skill | Purpose |
|-------|---------|
| `/card-updates` | Review + apply person/org card proposals |
| `/parse-clc [content/id]` | Parse CLC content → org/person nodes |
| `/clc-briefing <domain>` | Competitive/consortium landscape briefing |

**Daily workflow:**
```
/dashboard → /today → /quick (capture) → /daily-review
```

---

## Memory System

The memory system uses RA-H guides (not MEMORY.md files).

```
rah_read_guide("memory")          # Read curated memory
rah_write_guide("memory", ...)    # Update memory guide
```

Guides in `.claude/guides/`:
- `memory.md` — curated insights (replaces Atlas MEMORY.md)
- `pkm-dimensions.md` — dimension reference

Candidate insights: add as node with `dimensions: ["insight", "<domain>"]`
Promote to memory guide after proving durable (next weekly/monthly review).

---

## LLM Routing (Confidentiality)

```
metadata.confidential == true  →  Maci local LLM (Ollama Qwen 2.5 32B)
All other content              →  Claude (cloud)
```

Skills that check confidentiality: `/search-vault`, `/post-meeting`, `/meeting-prep`

---

## Ingestion Modes

Full reference: `.claude/docs/ingestion-modes.md`

| Source | Method |
|--------|--------|
| Quick tasks | `/quick` skill → `rah_add_node` |
| Meetings | `/post-meeting` skill |
| Email clippings | AppleScript → `POST /api/ingest/email` |
| Web articles | RA-H chat → `websiteExtractTool` |
| PDFs | RA-H chat → `paperExtractTool` |
| YouTube | RA-H chat → `youtubeExtractTool` |
| Paperless docs | `scripts/paperless/ingest.py` (Phase 4) |

---

## Migration from Obsidian

One-time migration script: `scripts/migrate/import_pkm2026.ts`

```bash
# Dry run (no writes)
npx ts-node scripts/migrate/import_pkm2026.ts --dry-run

# Migrate all folders
npx ts-node scripts/migrate/import_pkm2026.ts

# Migrate specific folder
npx ts-node scripts/migrate/import_pkm2026.ts --folder notes
```

Source vault: `/Users/balazsfurjes/Cursor files/PKM_2026/` (archived, read-only)

---

## Key Directories

```
.claude/
  commands/      # 20 slash command skill files
  guides/        # memory.md, pkm-dimensions.md
  docs/          # ingestion-modes.md

apps/
  mcp-server-standalone/  # Node MCP server (index.js)

scripts/
  migrate/
    import_pkm2026.ts     # Obsidian → RA-H migration

docs/
  2_schema.md             # Database schema
  4_tools-and-guides.md   # MCP tools reference
  8_mcp.md                # MCP setup
```

---

## Agent System

| Agent | Model | Role |
|-------|-------|------|
| Orchestrator Easy | GPT-4o Mini | Fast orchestration (default) |
| Orchestrator Hard | Claude Sonnet 4.5 | Deep reasoning |
| Oracle | GPT-4o | Complex workflows, multi-step |
| Delegates | GPT-4o Mini | Write ops, extraction, batch |

---

## Database Schema (key tables)

```sql
nodes          -- id, title, content, description, link, metadata (JSON)
node_dimensions -- node_id, dimension_name
dimensions     -- name, description, is_priority
edges          -- id, source_id, target_id, explanation
chunks         -- id, node_id, chunk (full source text)
guides         -- name, content (markdown files)
```

Full schema: `docs/2_schema.md`

---

## Infrastructure

- **Neo4j** (Maci): stays operational for BIO-RED project graph — not replaced by RA-H
- **Paperless-ngx** (Maci): document archive, linked to RA-H via `metadata.paperless_id`
- **Ollama** (Maci): local LLM for confidential content routing

---

## Contributing

See `CONTRIBUTING.md`. MIT license.
