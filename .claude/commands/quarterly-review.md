# /quarterly-review — Synthesize monthly patterns into quarterly insights

Aggregate monthly reviews into a quarterly synthesis. Identify strategic shifts, long-term patterns, and update the memory guide with durable insights.

## Input

Arguments: `$ARGUMENTS`

- Empty → review the most recently completed quarter
- `YYYY-QN` → specific quarter (e.g. `2026-Q1`)

## Step 1: Determine quarter range

Q1: Jan–Mar | Q2: Apr–Jun | Q3: Jul–Sep | Q4: Oct–Dec

## Step 2: Load monthly review nodes

```sql
SELECT n.id, n.title, n.content
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE nd.dimension_name = 'note'
  AND n.title LIKE 'Monthly Review — %'
  AND n.created_at BETWEEN '<quarter_start>' AND '<quarter_end>'
ORDER BY n.created_at ASC
```

## Step 3: Load domain-level task completion over the quarter

```sql
SELECT nd2.dimension_name AS domain, COUNT(*) AS completed
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id AND nd.dimension_name = 'task'
JOIN node_dimensions nd2 ON nd2.node_id = n.id
JOIN node_dimensions nd3 ON nd3.node_id = n.id AND nd3.dimension_name = 'complete'
WHERE json_extract(n.metadata, '$.completed_at') BETWEEN '<start>' AND '<end>'
  AND nd2.dimension_name NOT IN ('task','complete','pending','active','archived','insight','proposal','memory-log')
GROUP BY nd2.dimension_name
ORDER BY completed DESC
```

## Step 4: Identify strategic patterns

From monthly themes, extract:
- **Strategic patterns**: What changed direction, what compounded?
- **Relationship developments**: Which relationships strengthened/weakened?
- **Domain shifts**: Where did focus move vs. the plan?
- **Technical capabilities**: New tools/processes established?
- **Long-term risks / opportunities**: What's emerging?

## Step 5: Reflection prompts

Ask the user:
1. "What was the most important thing you built or established this quarter?"
2. "What did you consistently avoid or postpone — and why?"
3. "What changed that you didn't expect?"

## Step 6: Create quarterly review node

```
rah_add_node:
  title: "Quarterly Review — 2026-Q1"
  dimensions: ["note", "admin"]
  content: |
    # Quarterly Review — Q1 2026

    ## Strategic Patterns
    - <pattern>

    ## Domain Focus (by task completion)
    | Domain | Tasks | % of total |
    |--------|-------|------------|
    | BIO-RED | N | X% |

    ## Key Reflections
    Q: Most important thing built?
    A: <answer>

    Q: What was consistently avoided?
    A: <answer>

    Q: What changed unexpectedly?
    A: <answer>

    ## Relationship Developments
    - <stakeholder> — <development>

    ## Capabilities Built
    - <new tool/process>

    ## Looking Ahead (Q2 priorities)
    - <priority>

    ## Memory Guide Changes
    - Promoted N insights
    - Archived N stale entries
  metadata: { quarter: "2026-Q1" }
```

## Step 7: Memory guide update

Review all insight nodes created this quarter. For durable ones, add to `rah_write_guide("memory", <updated>)` under relevant sections (Domain Dynamics, Relationships, Workflow Patterns, etc.).

Archive insight nodes that proved wrong or irrelevant: add `archived` dimension.

## Edge cases

- No monthly reviews: summarise directly from weekly reviews in the quarter
- Current quarter (in progress): note "Q1 in progress" and show partial synthesis
