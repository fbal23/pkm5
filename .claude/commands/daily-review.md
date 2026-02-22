# /daily-review — End-of-day review and task status update

Compare planned vs actual work, update task statuses, append review section to today's daily node, and prompt for memory candidates.

## Input

Arguments: `$ARGUMENTS`

- Empty → review today
- `YYYY-MM-DD` → review a specific past day

## Step 1: Load today's daily node

```
rah_search_nodes(query="Daily Plan <date>", dimensions=["note"], limit=1)
```

If not found: "No daily note for <date>. Run `/today` first."

Load the node to get the planned tasks.

## Step 2: Check task completion status

Query tasks that were due today:
```sql
SELECT n.id, n.title,
  json_extract(n.metadata, '$.due') AS due,
  json_extract(n.metadata, '$.completed_at') AS completed_at,
  GROUP_CONCAT(nd.dimension_name, '|') AS dimensions
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension_name = 'task')
  AND json_extract(n.metadata, '$.due') = '<date>'
GROUP BY n.id
```

Classify:
- **Completed planned**: in due-today list AND has `complete` dimension
- **Completed unplanned**: has `complete` dimension + `completed_at == today` but not in due-today list
- **Incomplete**: in due-today list AND still `pending`

## Step 3: Check git activity across projects

```bash
git -C "/Users/balazsfurjes/Cursor files/ra-h_os" log --oneline --since="<date> 00:00" --until="<date> 23:59" --author="$(git config user.email)"
```

Run for all active project repos. Summarise commits by repo.

## Step 4: Display comparison table

```
## Daily Review — 2026-02-22

### Planned vs Actual

| Status | Task | Domain |
|--------|------|--------|
| ✓ Done | Review HAC26 proposal | HAC26 |
| ✗ Missed | Update BIO-RED tables | BIO-RED |
| + Unplanned | Fix RA-H MCP server error | AI_development |

Completed: N/M planned | Unplanned completions: N
```

## Step 5: Update task statuses interactively

For each incomplete planned task:
> "Mark 'Update BIO-RED tables' as: [c]omplete / [p]ostpone (new due?) / [s]kip"

For postponed tasks: `rah_update_node(id, updates={ metadata: { due: "<new date>" } })`

## Step 6: Append review section to daily node

```
rah_update_node(id=dailyNodeId, updates={
  content: <append>

---
## End-of-Day Review

### What Got Done
- ✓ <completed task>

### What Didn't (carrying forward)
- ✗ <incomplete task> → postponed to <date>

### Unplanned Work
- + <unplanned completion>

### Cross-Project Activity
- ra-h_os: N commits (feat: ..., fix: ...)

### Discipline Check
- Focus maintained: yes/no
- Distractions: ...

### Memory Candidates
- <potential insight for memory>
  </append>
})
```

## Step 7: Prompt for memory updates

Present memory candidates identified:
> "Worth adding to memory: '<insight>'. Save as insight node? (yes/no/edit)"

If yes: `rah_add_node(title="<insight>", dimensions=["insight", "<domain>"])`

## Step 8: Random revisit (serendipity)

Pull one older node (created 30+ days ago, not accessed recently):
```sql
SELECT id, title FROM nodes
WHERE created_at < date('now', '-30 days')
ORDER BY RANDOM() LIMIT 1
```

> "Random revisit: **<title>** — worth updating or archiving?"

## Edge cases

- No daily note: prompt to create one retroactively
- No tasks due: show unplanned work + git activity only
- Git not available for a repo: skip that repo silently
