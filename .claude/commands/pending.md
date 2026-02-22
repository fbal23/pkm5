# /pending — List all pending tasks

List all pending tasks from RA-H, optionally filtered by domain or project.

## Input

Arguments: `$ARGUMENTS`

Parse:
- `domain:<name>` → filter by that domain dimension (e.g. `domain:BIO-RED`)
- `project:<name>` → filter to tasks linked to a named project node
- Empty → show all pending tasks

## Step 1: Query pending tasks

Run SQL to fetch tasks grouped by urgency:

```
rah_sqlite_query:
SELECT
  n.id,
  n.title,
  json_extract(n.metadata, '$.due') AS due,
  json_extract(n.metadata, '$.project') AS project,
  GROUP_CONCAT(nd.dimension_name, ', ') AS dimensions
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (
  SELECT node_id FROM node_dimensions WHERE dimension_name = 'task'
)
AND n.id IN (
  SELECT node_id FROM node_dimensions WHERE dimension_name = 'pending'
)
[AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension_name = '<domain>')]
GROUP BY n.id
ORDER BY due ASC NULLS LAST
```

If `domain:X` was specified, add the domain filter clause.

## Step 2: Categorise by urgency

Group results:
- **Overdue**: due date < today
- **Due today**: due date = today
- **Due this week**: due within 7 days
- **Later**: due date > 7 days from now
- **No due date**: due IS NULL

## Step 3: Render table

For each group, display:

```
## Overdue (N)
| Due | Domain | Project | Task |
|-----|--------|---------|------|
| 2026-02-18 | BIO-RED | value-chain | Update internal ID tables |

## Due Today (N)
...

## Due This Week (N)
...

## Later (N)
...

## No Due Date (N)
...
```

## Step 4: Summary

```
Total pending: N tasks
Overdue: N | Due today: N | This week: N | Later: N | No date: N
```

If no tasks found: "No pending tasks." (possibly filtered by domain)
