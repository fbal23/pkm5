# /card-updates — Review and apply person/org card update proposals

Review proposed updates to person and org entity cards, stored as `proposal` dimension nodes in RA-H, and apply approved ones.

## Input

Arguments: `$ARGUMENTS`

- Empty → show all pending proposals
- `domain:<name>` → filter to domain
- `apply-all` → apply all proposals without review

## Step 1: Load pending proposals

```sql
SELECT n.id, n.title, n.content, n.metadata,
  GROUP_CONCAT(nd.dimension_name, '|') AS dimensions
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension_name = 'proposal')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension_name = 'pending')
GROUP BY n.id
ORDER BY n.created_at ASC
```

## Step 2: Display proposals

For each proposal:
```
Proposal (ID: N): Update person card for "Name"
  Domain: EIT Water
  Proposed changes:
    role: Programme Manager → Head of Innovation
    last: 2026-01-15 → 2026-02-20
    cited: 3 → 4

  [A]pply | [E]dit | [S]kip | [D]elete
```

## Step 3: Apply approved proposals

Find the target person/org node:
```
rah_search_nodes(query="<target name>", dimensions=["person"/"org"], limit=1)
```

Apply the update:
```
rah_update_node(targetId, { metadata: <updated fields> })
```

Mark proposal as complete:
```
rah_update_node(proposalId, updates={
  dimensions: ["proposal", "<domain>", "complete"]
})
```

## Step 4: Generate new proposals (optional)

After reviewing clippings and meetings with `/parse-clippings` or `/post-meeting`, new proposals may have been surfaced.

Ask: "Generate card update proposals from recent meeting nodes? (yes/no)"

If yes: scan recent meeting nodes (last 7 days) for person/org mentions not yet reflected in their cards.

## Summary

```
Card updates:
  Proposals reviewed: N
  Applied: N | Skipped: N | Deleted: N
  New proposals generated: N
```
