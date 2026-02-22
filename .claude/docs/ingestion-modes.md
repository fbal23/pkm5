# PKM5 Ingestion Modes

All capture paths into the PKM5 knowledge graph. Prefer existing tools where available; build new routes only for gaps.

---

## Quick Capture

**Tool**: `/quick` skill → `pkm5_add_node`
**When**: Ultra-fast task capture from natural language
**Dimensions**: `["task", "<domain>"]`

```
/quick "Review HAC26 proposal by Friday domain:HAC26"
```

Creates a node with `metadata.due`, inferred domain, parsed title.

---

## Task / Note / Idea Creation

**Tool**: `/new` skill → `pkm5_add_node` + `pkm5_create_edge`
**When**: Creating any typed entity with relationships
**Dimensions**: varies by type

```
/new "Project: redesign ClaimMore onboarding domain:ClaimMore"
```

---

## Meeting Notes

**Tool**: `/post-meeting` skill → `pkm5_add_node` (meeting) + `pkm5_create_edge` (attendees) + `pkm5_update_node` (person last_interaction)
**When**: After any meeting

---

## Email Clippings

**API**: `POST /api/ingest/email` (PKM5 HTTP API)
**Source**: AppleScript Mail rule → HTTP POST to PKM5
**Dimensions**: `["clipping", "<domain>"]`

The AppleScript handler in macOS Mail sends:
```json
{
  "from": "sender@example.com",
  "subject": "Email subject",
  "body": "Email content",
  "date": "2026-02-22"
}
```

**Status**: Needs wiring — AppleScript currently writes markdown files to PKM_2026/clippings/. Repoint to `POST http://localhost:3000/api/ingest/email`.

---

## Web Clippings

**Tool**: PKM5's built-in `websiteExtractTool`
**When**: Saving web articles, documentation, research
**Via**: PKM5 chat interface → "Save this page"

No additional setup needed.

---

## PDF / Document Capture

**Tool**: PKM5's built-in `paperExtractTool`
**When**: Saving PDF documents
**Via**: PKM5 chat interface → "Save this PDF"

No additional setup needed.

---

## YouTube

**Tool**: PKM5's built-in `youtubeExtractTool`
**When**: Saving YouTube videos / transcripts
**Via**: PKM5 chat interface

No additional setup needed.

---

## Paperless-ngx Documents

**Script**: `scripts/paperless/ingest.py` (Phase 4 — not yet implemented)
**When**: Syncing Paperless documents to PKM5 nodes
**Dimensions**: `["clipping", "<domain>"]` + metadata with `paperless_id`

Planned pipeline:
1. Fetch new documents from Paperless API
2. Create PKM5 node per document
3. Link to person/org/project nodes via edges
4. Store `paperless_id` in metadata for round-tripping

**Existing**: `PKM_2026/Atlas-framework/enrich_from_paperless.py` enriches existing nodes with OCR text. Needs extension for full ingest.

---

## iOS / Mobile Capture

**API**: `POST /api/capture/quick` (to be implemented)
**Source**: iOS Shortcuts → HTTP POST

Planned payload:
```json
{
  "title": "Quick note text",
  "domain": "admin",
  "type": "task"
}
```

**Status**: iOS Shortcuts currently write markdown to PKM_2026/notes/ via SSH. Repoint to PKM5 API endpoint once `/api/capture/quick` is built.

---

## Obsidian Vault Migration (one-time)

**Script**: `scripts/migrate/import_pkm2026.ts`
**When**: One-time migration of ~210 existing vault nodes

Migrates: notes/, references/, clippings/ from PKM_2026 vault.

---

## Capture Decision Tree

```
New information to capture?
├── Task/commitment/idea? → /quick or /new skill
├── Meeting just happened? → /post-meeting skill
├── Email worth saving? → AppleScript → POST /api/ingest/email
├── Web article? → PKM5 chat → websiteExtractTool
├── PDF document? → PKM5 chat → paperExtractTool
├── YouTube video? → PKM5 chat → youtubeExtractTool
├── Paperless doc? → scripts/paperless/ingest.py (Phase 4)
└── Mobile capture? → iOS Shortcut → POST /api/capture/quick (Phase 2)
```
