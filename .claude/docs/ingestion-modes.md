# RA-H Ingestion Modes

All capture paths into the RA-H knowledge graph. Prefer existing tools where available; build new routes only for gaps.

---

## Quick Capture

**Tool**: `/quick` skill → `rah_add_node`
**When**: Ultra-fast task capture from natural language
**Dimensions**: `["task", "<domain>"]`

```
/quick "Review HAC26 proposal by Friday domain:HAC26"
```

Creates a node with `metadata.due`, inferred domain, parsed title.

---

## Task / Note / Idea Creation

**Tool**: `/new` skill → `rah_add_node` + `rah_create_edge`
**When**: Creating any typed entity with relationships
**Dimensions**: varies by type

```
/new "Project: redesign ClaimMore onboarding domain:ClaimMore"
```

---

## Meeting Notes

**Tool**: `/post-meeting` skill → `rah_add_node` (meeting) + `rah_create_edge` (attendees) + `rah_update_node` (person last_interaction)
**When**: After any meeting

---

## Email Clippings

**API**: `POST /api/ingest/email` (RA-H HTTP API)
**Source**: AppleScript Mail rule → HTTP POST to RA-H
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

**Tool**: RA-H's built-in `websiteExtractTool`
**When**: Saving web articles, documentation, research
**Via**: RA-H chat interface → "Save this page"

No additional setup needed.

---

## PDF / Document Capture

**Tool**: RA-H's built-in `paperExtractTool`
**When**: Saving PDF documents
**Via**: RA-H chat interface → "Save this PDF"

No additional setup needed.

---

## YouTube

**Tool**: RA-H's built-in `youtubeExtractTool`
**When**: Saving YouTube videos / transcripts
**Via**: RA-H chat interface

No additional setup needed.

---

## Paperless-ngx Documents

**Script**: `scripts/paperless/ingest.py` (Phase 4 — not yet implemented)
**When**: Syncing Paperless documents to RA-H nodes
**Dimensions**: `["clipping", "<domain>"]` + metadata with `paperless_id`

Planned pipeline:
1. Fetch new documents from Paperless API
2. Create RA-H node per document
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

**Status**: iOS Shortcuts currently write markdown to PKM_2026/notes/ via SSH. Repoint to RA-H API endpoint once `/api/capture/quick` is built.

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
├── Web article? → RA-H chat → websiteExtractTool
├── PDF document? → RA-H chat → paperExtractTool
├── YouTube video? → RA-H chat → youtubeExtractTool
├── Paperless doc? → scripts/paperless/ingest.py (Phase 4)
└── Mobile capture? → iOS Shortcut → POST /api/capture/quick (Phase 2)
```
