# /parse-clippings — Process unread clippings and extract action items

Find unprocessed clipping nodes in RA-H, extract decisions/actions, create links, promote inline `#action` items to task nodes.

## Input

Arguments: `$ARGUMENTS`

- Empty → process all `pending` clipping nodes
- `domain:<name>` → filter to that domain's clippings
- `id:<n>` → process a specific clipping node

## Step 1: Find unprocessed clippings

```sql
SELECT n.id, n.title, n.content,
  json_extract(n.metadata, '$.from') AS sender,
  json_extract(n.metadata, '$.subject') AS subject,
  GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'clipping')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'pending')
GROUP BY n.id
ORDER BY n.created_at ASC
LIMIT 20
```

Apply domain filter if specified.

## Step 2: Process each clipping

For each clipping node, extract:
1. **Action items**: phrases like "please review", "can you", "action required", `#action` tags
2. **Decisions / information**: key facts, decisions communicated
3. **People mentioned**: names → resolve against person nodes
4. **Related projects/tasks**: topic links to existing nodes

## Step 3: Promote action items to task nodes

For each identified action item:
```
rah_add_node:
  title: "<action item text>"
  dimensions: ["task", "<domain>", "pending"]
  description: "From clipping: <clipping title>"
  metadata: { due: "<parsed date if any>", source_clipping: <clipping_id> }
```

Create edge: `rah_create_edge(taskId, clippingId, "action item extracted from")`

## Step 4: Link to people and projects

For each mentioned person/project found in search:
```
rah_create_edge(clippingId, personId, "mentions <Name>")
rah_create_edge(clippingId, projectId, "related to project")
```

## Step 5: Mark clipping as processed

```
rah_update_node(id=clippingId, updates={
  dimensions: ["clipping", "<domain>", "active"],  // remove 'pending', add 'active'
  metadata: { ...existing, processed_at: "<today>" }
})
```

## Step 6: Summary

```
Processed N clippings:
  · "<clipping title>" → N actions extracted, M links created
  · ...

Tasks created: N total
```

## Edge cases

- No clippings pending: "No unprocessed clippings found."
- Clipping has no actionable content: mark as active without creating tasks, note "No actions extracted"
- Person mentioned but not found: create person stub or skip (ask user preference)
