# /dashboard — Quick overview of pending work

Render a terminal-friendly dashboard of the current state of the knowledge graph. Shows pending tasks by urgency, active projects, approaching commitments, and unprocessed clippings. Supports domain filtering.

## Input

Arguments: `$ARGUMENTS`

Parse:
- `domain:<name>` → filter all sections to that domain
- Empty → show all domains

## Step 1: Fetch data in parallel

Run these queries (use `rah_sqlite_query`):

### Tasks query
```sql
SELECT n.id, n.title,
  json_extract(n.metadata, '$.due') AS due,
  GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'task')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'pending')
GROUP BY n.id ORDER BY due ASC NULLS LAST LIMIT 30
```

### Projects query
```sql
SELECT n.id, n.title,
  json_extract(n.metadata, '$.outcome') AS outcome,
  GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'project')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'active')
GROUP BY n.id ORDER BY n.created_at DESC LIMIT 10
```

### Commitments query
```sql
SELECT n.id, n.title,
  json_extract(n.metadata, '$.due') AS due,
  json_extract(n.metadata, '$.confidential') AS confidential,
  GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'commitment')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension IN ('pending', 'active'))
GROUP BY n.id ORDER BY due ASC NULLS LAST LIMIT 10
```

### Unprocessed clippings query
```sql
SELECT n.id, n.title,
  json_extract(n.metadata, '$.from') AS sender,
  json_extract(n.metadata, '$.subject') AS subject,
  GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'clipping')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'pending')
GROUP BY n.id ORDER BY n.created_at DESC LIMIT 10
```

Apply domain filter to all queries if `domain:X` was specified.

## Step 2: Compute urgency

For tasks and commitments:
- **🔴 Overdue**: due < today
- **🟡 Due today**: due = today
- **🟠 Due this week**: due within 7 days
- **🟢 Later**: due > 7 days
- **⚪ No date**: no due date

## Step 3: Backlog health

```
🟢 Healthy    — 0 overdue, ≤3 due today
🟡 Tight      — 1-2 overdue OR >3 due today
🔴 Critical   — 3+ overdue
```

## Step 4: Render dashboard

```
═══════════════════════════════════════════════════════
  PKM DASHBOARD  [domain: ALL | <domain>]  2026-02-22
  Backlog: 🟢 Healthy | Tasks: N | Projects: N active
═══════════════════════════════════════════════════════

── TASKS ────────────────────────────────────────────
🔴 OVERDUE
  · Task title (BIO-RED) — was due 2026-02-18

🟡 DUE TODAY
  · Task title (admin) — 2026-02-22

🟠 THIS WEEK
  · Task title (EIT Water) — 2026-02-25

🟢 LATER
  · Task title (HAC26) — 2026-03-01

── ACTIVE PROJECTS ──────────────────────────────────
  · Project name (BIO-RED) — outcome: ...
  · Project name (EIT Water)

── COMMITMENTS (approaching) ────────────────────────
  · Commitment title (EIT Water) — due 2026-02-28 (6 days)
  · [confidential] — due 2026-03-05

── UNPROCESSED CLIPPINGS ────────────────────────────
  · Subject line (from sender) — EIT Water

═══════════════════════════════════════════════════════
```

If a section is empty, omit it.

## Notes

- Confidential commitments: show "[confidential]" instead of title
- If filtering by domain, show domain name in header
