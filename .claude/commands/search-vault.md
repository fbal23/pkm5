# /search-vault — Semantic search across the knowledge graph

Search the RA-H knowledge graph using natural language. Handles confidential content routing.

## Input

Arguments: `$ARGUMENTS`

Parse:
- Main query text — required
- `domain:<name>` → filter results to that domain
- `limit:<n>` → max results (default 10)
- `type:<entitytype>` → filter by entity type dimension

Example: `/search-vault HAC26 proposal deadline domain:HAC26 limit:5`

## Step 1: Keyword search

Use `rah_search_nodes` with the query. Pass domain and type as dimension filters if specified.

## Step 2: Content search (optional)

If keyword search returns fewer than 3 results, also run `rah_search_content` with the same query to search across node chunks.

## Step 3: Apply LLM routing policy per result

For each result node, evaluate routing using this priority order:

### Routing decision table

| Condition | Route | Action |
|-----------|-------|--------|
| `metadata.confidential == true` | **Local** (priority 1, certain) | Withhold content; show title + date only; note at end |
| Query is simple task (`summarize`, `list`, `extract`, `classify`, `format`, `convert`) | **Local** (priority 2, 0.7 confidence) | Process via Maci Ollama — see local call below |
| Query is complex reasoning (`analyze`, `synthesize`, `plan`, `evaluate`, `recommend`, `compare`) | **Cloud** (priority 3, 0.7 confidence) | Claude answers directly |
| No signal | **Cloud** (default, 0.5 confidence) | Claude answers directly |

### For confidential nodes (route = local)

Do NOT include node content in your response. Display:

```
### N. <Node Title>  🔒 confidential
**Type**: meeting | **Domain**: EIT Water | **Date**: 2026-02-15
[Content withheld — confidential flag set]
```

To process a confidential node locally, the user can run:
```bash
curl http://100.100.142.16:11434/api/generate \
  -d '{"model":"qwen2.5:32b","stream":false,"prompt":"<paste node content here>\n\nQuestion: <query>"}'
```
Maci Ollama endpoint: `http://100.100.142.16:11434` — requires Tailscale to be active.

### For non-confidential nodes (route = cloud)

Include full content in synthesis. Claude answers directly.

## Step 4: Display results

```
## Search: "<query>" [domain: X | type: Y]
Found N results (N public, M confidential 🔒)

### 1. Node Title
**Type**: meeting | **Domain**: EIT Water
**Date**: 2026-02-15

> Description or first 200 chars of content...

---

### 2. Node Title  🔒 confidential
**Type**: commitment | **Domain**: EIT Water
[Content withheld — confidential flag set]

---
```

## Step 5: Synthesise answer

Synthesise a direct answer using only non-confidential content. Attribute each claim.

If confidential nodes were withheld, append:
```
---
🔒 N confidential node(s) matched but were withheld.
To query them locally: curl http://100.100.142.16:11434/api/generate \
  -d '{"model":"qwen2.5:32b","stream":false,"prompt":"<content>\n\nQuestion: <query>"}'
```

## Edge cases

- No results: "No matches found for '<query>'. Try broader terms or check dimensions."
- Query too short: expand before searching
- All results confidential: "All N matches are confidential 🔒 — no public content to synthesise. Use local Ollama to query them."
