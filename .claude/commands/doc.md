# /doc — Search Paperless-ngx documents and their linked RA-H nodes

Search for documents in Paperless-ngx, show their linked RA-H nodes, and optionally ingest new documents.

## Input

Arguments: `$ARGUMENTS`

- Search text → search Paperless for matching documents
- `ingest` → trigger Paperless → RA-H ingest pipeline
- `orphans` → show Paperless docs with no RA-H node

## Setup check

Read Paperless token:
```bash
cat ~/.config/pkm/paperless_token
```

If missing: "Set up Paperless token: `echo 'TOKEN' > ~/.config/pkm/paperless_token`"

Paperless base URL: `http://maci:8000` (adjust if different).

## Mode 1: Search documents

Call Paperless API:
```
GET http://maci:8000/api/documents/?search=<query>&page_size=10
Authorization: Token <token>
```

For each result, also search RA-H for linked nodes:
```sql
SELECT n.id, n.title, GROUP_CONCAT(nd.dimension_name, '|') AS dimensions
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE json_extract(n.metadata, '$.paperless_id') = <paperless_doc_id>
GROUP BY n.id
```

Display:
```
## Document Results for "<query>"

### 1. Document Title (Paperless ID: 42)
Date: 2026-01-15 | Correspondent: EIT Water
Tags: budget, Q1

Linked RA-H nodes:
  · [project] EIT Water Q1 Budget (ID: 87)
  · [clipping] Budget email thread (ID: 91)

---

### 2. ...
```

## Mode 2: Ingest new documents

Find Paperless documents without a corresponding RA-H node:
```
GET http://maci:8000/api/documents/?page_size=100
```

Cross-reference: `SELECT json_extract(metadata, '$.paperless_id') FROM nodes`

For each unlinked document, create RA-H node:
```
rah_add_node:
  title: "<Paperless doc title>"
  dimensions: ["clipping", "<inferred domain>", "pending"]
  content: "<OCR text from Paperless>"
  metadata: {
    paperless_id: <id>,
    correspondent: "<name>",
    paperless_created: "<date>",
    tags: ["<tag1>", "<tag2>"]
  }
```

Infer domain from Paperless correspondent/tags using domain keywords.

## Mode 3: Find orphan documents

Show Paperless docs that have no RA-H node:
```
All Paperless IDs: from API
Linked IDs: SELECT json_extract(metadata, '$.paperless_id') FROM nodes WHERE ...
Orphans = All - Linked
```

Display orphan list with Paperless IDs and titles for batch ingest.

## Edge cases

- Paperless unreachable: "Paperless unavailable at maci:8000 — check if Docker is running."
- No token: show setup instructions
- Document already linked: skip (don't create duplicate)
