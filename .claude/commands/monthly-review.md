# /monthly-review — Distill weekly themes into monthly patterns

Aggregate weekly summaries and node activity into a monthly review. Identify persistent patterns, major milestones, and domain health.

## Input

Arguments: `$ARGUMENTS`

- Empty → review the most recently completed month
- `YYYY-MM` → specific month (e.g. `2026-02`)

## Step 1: Determine month range

First and last day of the target month.

## Step 2: Load weekly review nodes for the month

```sql
SELECT n.id, n.title, n.content
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE nd.dimension = 'note'
  AND n.title LIKE 'Weekly Review — %'
  AND json_extract(n.metadata, '$.date_range') LIKE '<YYYY-MM>%'
  OR (n.created_at BETWEEN '<first>' AND '<last>' AND n.title LIKE 'Weekly Review — %')
ORDER BY n.created_at ASC
```

## Step 3: Aggregate completed tasks by domain

```sql
SELECT
  nd2.dimension AS domain,
  COUNT(*) AS completed_tasks
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id AND nd.dimension = 'task'
JOIN node_dimensions nd2 ON nd2.node_id = n.id
JOIN node_dimensions nd3 ON nd3.node_id = n.id AND nd3.dimension = 'complete'
WHERE json_extract(n.metadata, '$.completed_at') BETWEEN '<first>' AND '<last>'
  AND nd2.dimension NOT IN ('task', 'complete', 'pending', 'active', 'archived')
GROUP BY nd2.dimension
ORDER BY completed_tasks DESC
```

## Step 4: Node creation summary

```sql
SELECT
  nd.dimension AS type_or_domain,
  COUNT(*) AS created
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.created_at BETWEEN '<first>' AND '<last>'
GROUP BY nd.dimension
ORDER BY created DESC
```

## Step 5: Compile monthly synthesis

From weekly review contents, extract:
- **Major milestones**: deliverables completed, projects advanced
- **Persistent patterns**: themes that appeared in 2+ weekly reviews
- **Domain focus**: where did most work go?
- **Carried-forward backlog**: items repeatedly postponed

## Step 6: Ask for monthly theme

> "What's the one-sentence theme of this month?"

## Step 7: Create monthly review node

```
pkm5_add_node:
  title: "Monthly Review — 2026-02"
  dimensions: ["note", "admin"]
  content: |
    # Monthly Review — February 2026

    **Theme**: <user's theme>

    ## Major Milestones
    - <milestone>

    ## Persistent Patterns
    - <pattern that appeared 2+ weeks>

    ## Domain Activity
    | Domain | Tasks Completed | Nodes Created |
    |--------|----------------|---------------|
    | BIO-RED | N | N |
    | EIT Water | N | N |

    ## Backlog Health
    - Longest-carried task: <title> (N weeks)

    ## Memory Guide Review
    - Promoted N candidates to memory
    - Archived N stale entries

    ## Looking Ahead
    - <key priority for next month>
  metadata: { month: "2026-02" }
```

## Step 8: Memory guide maintenance

Review `pkm5_read_guide("memory")` for entries to promote or archive based on the month's evidence.

## Edge cases

- No weekly reviews: "No weekly reviews found for this month. Run `/weekly-review` each week."
- Partial month (current month): show partial, note it
