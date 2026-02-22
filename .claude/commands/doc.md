# /doc — Search and manage Paperless-ngx documents

Search for documents in Paperless-ngx, show their linked RA-H nodes, and trigger ingestion.

## Input

Arguments: `$ARGUMENTS`

- Search text → search Paperless for matching documents (Mode 1)
- `ingest` → ingest unlinked Paperless docs into RA-H (Mode 2)
- `orphans` → list Paperless docs with no RA-H node (Mode 3)
- `enrich` → fetch OCR content for nodes missing it (Mode 4)

## Setup check

```bash
cat ~/.config/pkm/paperless_token
```

If missing: "Set up Paperless token: `echo 'TOKEN' > ~/.config/pkm/paperless_token`"

Paperless runs on Maci via Docker (port 8000). Access via SSH tunnel — the scripts handle this automatically.

## Mode 1: Search documents

Open SSH tunnel and call Paperless API:
```bash
# Open tunnel in background (if not already open)
ssh -N -L 18000:localhost:8000 maci &
sleep 2
TOKEN=$(cat ~/.config/pkm/paperless_token)
curl -s "http://localhost:18000/api/documents/?search=<query>&page_size=10" \
  -H "Authorization: Token $TOKEN" | jq '.results[] | {id, title, created, correspondent}'
```

For each result, also find linked RA-H nodes:
```sql
SELECT n.id, n.title, GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE json_extract(n.metadata, '$.paperless_id') = <paperless_doc_id>
   OR json_extract(n.metadata, '$.obsidian.paperless_id') = <paperless_doc_id>
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
```

If no RA-H nodes found for a document, note: "Not yet ingested — run `/doc ingest` to link"

## Mode 2: Ingest new documents

Run the ingestion script:
```bash
cd /Users/balazsfurjes/Cursor\ files/ra-h_os
python scripts/paperless/ingest.py --mode ingest
```

For a dry run first:
```bash
python scripts/paperless/ingest.py --mode ingest --dry-run
```

The script:
- Finds Paperless docs with no linked RA-H node
- Creates `clipping` nodes with domain inferred from `domain:` tags
- Fetches OCR content and stores it in the node
- Creates edges to correspondent person/org nodes

## Mode 3: Find orphan documents

```bash
python scripts/paperless/ingest.py --mode orphans
```

Shows a table of all Paperless docs with no RA-H node, grouped by domain/correspondent.

## Mode 4: Enrich with OCR content

```bash
python scripts/paperless/ingest.py --mode enrich
```

Fetches full OCR text for existing RA-H nodes that have a `paperless_id` but no OCR content yet.

Use `--force` to re-fetch even if already enriched.

## Run all modes

```bash
python scripts/paperless/ingest.py --mode all
```

## Edge cases

- Paperless unreachable: script exits with clear error + instructions to check Docker on Maci
- No token: reads from `~/.config/pkm/paperless_token` or falls back to hardcoded value
- Document already linked: skipped automatically (no duplicates)
- RA-H not running: ingest mode exits with instructions to start `npm run dev`; enrich mode uses direct SQLite and works without the server
