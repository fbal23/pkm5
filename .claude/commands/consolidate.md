# /consolidate — Merge duplicates and promote inline actions to tasks

Find duplicate or near-duplicate nodes, merge them. Promote `#action` tagged items from meeting notes and clippings into proper task nodes.

## Input

Arguments: `$ARGUMENTS`

- Empty → run full consolidation
- `duplicates` → only duplicate detection
- `actions` → only promote #action items to tasks
- `domain:<name>` → scope to a domain

## Mode 1: Promote #action items

Find meeting and clipping nodes containing `#action` tagged items that haven't been promoted yet:

```sql
SELECT n.id, n.title, n.content
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE nd.dimension IN ('meeting', 'clipping')
  AND n.content LIKE '%#action%'
  AND n.id NOT IN (
    SELECT e.source_id FROM edges e WHERE e.explanation LIKE 'action item extracted from%'
  )
```

For each match, extract `#action` lines from the content.
Present to user: "Found N unprocessed #action items across M nodes. Promote all? (yes/review each/no)"

For each action item, create a task node:
```
pkm5_add_node:
  title: "<action text>"
  dimensions: ["task", "<domain>", "pending"]
  metadata: { due: "<parsed date>", source_node: <meeting_id> }
```

Create edge: `pkm5_create_edge(taskId, sourceNodeId, "action item extracted from")`

## Mode 2: Duplicate detection

Find nodes with very similar titles:
```sql
SELECT a.id AS id_a, a.title AS title_a,
       b.id AS id_b, b.title AS title_b
FROM nodes a JOIN nodes b ON a.id < b.id
WHERE lower(a.title) LIKE '%' || lower(substr(b.title, 1, 20)) || '%'
   OR lower(b.title) LIKE '%' || lower(substr(a.title, 1, 20)) || '%'
LIMIT 20
```

Also check via `pkm5_search_nodes` for ambiguous entity names (people, orgs).

For each potential duplicate pair, present:
```
Possible duplicate:
  A (ID: 42): "Review HAC26 proposal draft" — HAC26, task, pending
  B (ID: 38): "Review HAC26 draft proposal" — HAC26, task, pending

  [M]erge into A | [M]erge into B | [K]eep both | [S]kip
```

**Merge process:**
1. Keep the node with more content / newer creation date as primary
2. Append other node's content to primary: `pkm5_update_node(primaryId, { content: <appended> })`
3. Move all edges from duplicate to primary node
4. Archive the duplicate: add `archived` dimension

## Mode 3: Card updates (person/org)

Find person and org nodes where `metadata.last` is >90 days old or `metadata.cited` is 0:

```sql
SELECT n.id, n.title, n.metadata
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE nd.dimension = 'person'
  AND (
    json_extract(n.metadata, '$.last') < date('now', '-90 days')
    OR json_extract(n.metadata, '$.cited') = 0
    OR json_extract(n.metadata, '$.cited') IS NULL
  )
LIMIT 10
```

Flag for review: "These person cards haven't been touched in 90+ days: ..."

## Summary

```
Consolidation complete:
  #action items promoted: N tasks created
  Duplicate pairs found: N | Merged: N | Kept: N
  Stale person cards flagged: N
```
