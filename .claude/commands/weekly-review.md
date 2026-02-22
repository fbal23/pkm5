# /weekly-review — Compile the week's daily insights into themes

Aggregate daily nodes, git history, task completions, and patterns into a weekly summary node. Check for stale memory entries and unresolved gaps.

## Input

Arguments: `$ARGUMENTS`

- Empty → review the most recently completed week (Mon–Sun)
- `YYYY-WNN` → specific week (e.g. `2026-W07`)

## Step 1: Determine week range

Calculate Monday and Sunday dates for the target week.

## Step 2: Load daily nodes for the week

```sql
SELECT n.id, n.title, n.content, n.created_at
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE nd.dimension_name = 'note'
  AND n.title LIKE 'Daily Plan — %'
  AND n.created_at BETWEEN '<monday>' AND '<sunday>'
ORDER BY n.created_at ASC
```

## Step 3: Load completed tasks for the week

```sql
SELECT n.id, n.title,
  json_extract(n.metadata, '$.completed_at') AS completed_at,
  GROUP_CONCAT(nd.dimension_name, '|') AS dimensions
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension_name = 'task')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension_name = 'complete')
  AND json_extract(n.metadata, '$.completed_at') BETWEEN '<monday>' AND '<sunday>'
GROUP BY n.id
```

## Step 4: Load created nodes for the week

```sql
SELECT id, title, GROUP_CONCAT(nd.dimension_name, '|') AS dimensions
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.created_at BETWEEN '<monday>' AND '<sunday>'
GROUP BY n.id ORDER BY n.created_at ASC
```

## Step 5: Scan git history

```bash
git -C "/Users/balazsfurjes/Cursor files/ra-h_os" log --oneline \
  --since="<monday>" --until="<sunday> 23:59"
```

Categorise commits: feat, fix, docs, refactor, chore. Summarise by repo.

## Step 6: Compile accomplishments and patterns

From daily review sections and completed tasks, identify:
- Key accomplishments (concrete deliverables)
- Carried-forward items (incomplete tasks)
- Recurring patterns (what came up multiple times)
- Cross-domain work (tasks spanning domains)

## Step 7: Stale memory check

From `rah_read_guide("memory")`, identify entries that:
- Were added >90 days ago
- Haven't been referenced in any recent node
- May be outdated

Flag for review: "These memory entries may be stale: ..."

## Step 8: Ask for weekly theme

> "What's the one-line theme of this week?"

## Step 9: Create weekly summary node

```
rah_add_node:
  title: "Weekly Review — 2026-W07 (Feb 16–22)"
  dimensions: ["note", "admin"]
  content: |
    # Weekly Review — 2026-W07

    **Theme**: <user's theme>

    ## Accomplishments
    - <deliverable 1>
    - <deliverable 2>

    ## Incomplete / Carried Forward
    - <task> → carrying to next week

    ## Patterns
    - <recurring theme or behaviour>

    ## Cross-Project Activity
    - ra-h_os: N commits (N feat, N fix)
    - BIO-RED: N commits

    ## Stale Memory Check
    - <entry> — flagged for review

    ## Memory Candidates
    - <insight> — promote if proven durable
  metadata: { week: "2026-W07", date_range: "2026-02-16/2026-02-22" }
```

## Step 10: Prompt for memory guide updates

Present multi-day patterns as memory candidates:
> "Pattern observed 3x this week: '<pattern>'. Add to memory guide? (yes/no)"

If yes: update `rah_write_guide("memory", <updated content>)` with new entry in relevant section.

## Edge cases

- No daily nodes for the week: "No daily notes found for week W07. Run `/today` each day."
- Partial week (current week in progress): show partial review, note it's incomplete
- No completed tasks: show "No tasks completed this week" — check if they were postponed
