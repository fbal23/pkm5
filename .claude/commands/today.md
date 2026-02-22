# /today — Generate daily planning note

Pull calendar events, list tasks due today, calculate work capacity, and produce a daily focus plan. Weekend mode is simplified.

## Input

Arguments: `$ARGUMENTS`

- `domain:<name>` → filter tasks/projects to domain
- Empty → show all domains

## Step 1: Check day type

```bash
date +%u
```
`1-5` = weekday (full planning), `6-7` = weekend (simplified mode).

## Step 2: Pull today's calendar events

```bash
icalBuddy -f -b "• " -nc -nrd -ic "Calendar,Work" eventsToday
```

If icalBuddy not available: "Calendar unavailable — install icalBuddy via `brew install ical-buddy`."

Parse events: extract start time, end time, title, location.
Calculate total blocked time.

## Step 3: Estimate work capacity (weekday only)

Ask: "How many focused hours do you have today? (or press Enter to estimate from calendar)"

If Enter pressed: estimate = 8h − blocked calendar time − 1h overhead.

Ask: "Any prep time needed for calendar events?" (e.g. 30min before a board call)
Subtract prep time from available capacity.

## Step 4: Load tasks due today (and overdue)

```sql
SELECT n.id, n.title,
  json_extract(n.metadata, '$.due') AS due,
  json_extract(n.metadata, '$.duration') AS duration,
  GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'task')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'pending')
  AND (
    json_extract(n.metadata, '$.due') = date('now')
    OR json_extract(n.metadata, '$.due') < date('now')
  )
GROUP BY n.id ORDER BY due ASC
```

Also load tasks due within 3 days (for "Next Up" section).

Apply domain filter if specified.

## Step 5: Load active projects and commitments

```sql
SELECT n.id, n.title, GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'project')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'active')
GROUP BY n.id LIMIT 10
```

```sql
SELECT n.id, n.title, json_extract(n.metadata, '$.due') AS due,
  json_extract(n.metadata, '$.confidential') AS confidential,
  GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'commitment')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension IN ('pending','active'))
  AND json_extract(n.metadata, '$.due') <= date('now', '+14 days')
GROUP BY n.id ORDER BY due ASC
```

## Step 6: Ask for daily focus

> "What's your focus/theme for today? (one line)"

## Step 7: Build capacity plan (weekday only)

Schedule tasks into time slots based on durations and available capacity.

| Time | Block | Duration |
|------|-------|----------|
| 09:00 | Calendar: EIT Water Call | 90min |
| 10:30 | Task: Review HAC26 proposal | 45min |
| ... | | |

Backlog health status:
- 🟢 Healthy — capacity ≥ tasks due today
- 🟡 Tight — capacity barely covers due today tasks
- 🔴 Critical — 3+ overdue, capacity < tasks

## Step 8: Render daily note content

Output this structure (for creating a new node or showing inline):

```markdown
# Daily Plan — 2026-02-22

## Focus
<user's daily theme>

## Calendar
• 09:00–10:30 EIT Water Board Call
• 14:00–15:00 1:1 with Balazs

## Capacity Plan
Available: ~4.5h | Blocked: 3.5h | Overhead: 1h

| # | Task | Domain | Est | Time |
|---|------|--------|-----|------|
| 1 | Review HAC26 proposal | HAC26 | 45min | 10:30 |

## Due Today (N)
- Task title [HAC26] — overdue since 2026-02-18

## Next Up (due this week)
- Task title [BIO-RED] — due 2026-02-24

## Active Projects
- Project name [EIT Water]

## Commitments (approaching)
- Commitment [EIT Water] — due 2026-02-28

## Notes
```

## Step 9: Create or update daily node

Search for existing daily node for today:
```
pkm5_search_nodes(query="Daily Plan 2026-02-22", dimensions=["note"], limit=1)
```

If exists: ask "Daily note for today already exists. Overwrite / Append / Cancel?"
If not: create with `pkm5_add_node(title="Daily Plan — <date>", dimensions=["note", "admin"])`.

## Weekend mode

Skip capacity planning, calendar prep questions. Show:
- Focus theme
- Optional tasks for the weekend
- Active projects status

## Edge cases

- icalBuddy missing: skip calendar section, note it
- No tasks due: "Clear day — no tasks due today."
- All tasks overdue with nothing for today: show critical backlog warning
