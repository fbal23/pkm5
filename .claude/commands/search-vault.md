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

## Step 3: Handle confidential content

For each result, check `metadata.confidential`:

- **Not confidential** (default): Claude answers directly using the node content
- **Confidential** (`metadata.confidential == true`): Route to local LLM

For confidential content routing:
```
The following content is flagged confidential.
Route synthesis to Maci local LLM (Qwen 2.5 32B via Ollama).
Do not include confidential content in the main response.
Note: "N confidential nodes found — synthesised locally."
```

## Step 4: Display results

```
## Search: "<query>" [domain: X | type: Y]
Found N results

### 1. Node Title
**Type**: meeting | **Domain**: EIT Water
**Date**: 2026-02-15
**Relevance**: high

> Description or first 200 chars of content...

---

### 2. ...
```

## Step 5: Synthesise answer

After showing results, synthesise a direct answer to the query using the retrieved context. Attribute each claim:
- Public content: answered directly
- Confidential content: "synthesised locally (not shown)"

## Edge cases

- No results: "No matches found for '<query>'. Try broader terms or check dimensions."
- Query too short: expand before searching
- All results confidential: "All matches are confidential — routing to local LLM for synthesis."
