# /delegate — Capture a delegated task

Record a task you're delegating to someone else. Creates a task node with delegation metadata and a link to the person it was delegated to.

## Input

Arguments: `$ARGUMENTS`

Free-form text describing the delegation. Optionally:
- `to:<name>` → person being delegated to
- `due:<date>` → expected completion date
- `domain:<name>` → domain

Example: `/delegate to:Anna Prepare Q1 report for EIT Water domain:EIT Water due:2026-03-15`

## Step 1: Parse delegation

Extract:
1. **Task description**: the work being delegated
2. **Delegate**: person name (from `to:X` or inferred from text)
3. **Due date**: parse date if present
4. **Domain**: from `domain:X` or infer
5. **Context**: any additional context to pass along

## Step 2: Resolve delegate

Search PKM5 for the person:
```
pkm5_search_nodes(query="<delegate name>", dimensions=["person"], limit=2)
```

If found: confirm which person.
If not found: offer to create person stub.

## Step 3: Create delegation task node

```
pkm5_add_node:
  title: "DELEGATED: <task description>"
  dimensions: ["task", "<domain>", "pending"]
  description: "Delegated to <Name> — expected by <due date>"
  metadata: {
    due: "<YYYY-MM-DD>",
    delegated_to: "<name>",
    delegated_to_id: <person_node_id>,
    delegated_at: "<today>"
  }
```

## Step 4: Create edge

```
pkm5_create_edge(taskId, personId, "delegated to <Name>")
```

## Step 5: Confirm

```
✓ Delegation recorded (ID: N): "Prepare Q1 report for EIT Water"
  Delegated to: Anna Kovacs (EIT Water)
  Due: 2026-03-15
  Edge: task → person (delegated to)
```

## Tracking delegated tasks

To review all delegated tasks:
```
pkm5_sqlite_query:
SELECT n.title, json_extract(n.metadata, '$.delegated_to') AS delegate,
  json_extract(n.metadata, '$.due') AS due
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE nd.dimension = 'task'
  AND json_extract(n.metadata, '$.delegated_to') IS NOT NULL
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'pending')
ORDER BY due ASC
```

## Edge cases

- No delegate specified: prompt "Who are you delegating to?"
- Person not in graph: create stub with name only, note "No profile on file"
