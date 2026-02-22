# /distill — Distill a batch of nodes into a synthesis note

Read a set of related nodes and synthesise their key ideas, patterns, and insights into a single distillation node.

## Input

Arguments: `$ARGUMENTS`

- `query:<text>` → search for nodes to distill
- `ids:<n1,n2,n3>` → specific node IDs to distill
- `domain:<name>` → distill all recent nodes in a domain
- `guide:<name>` → distill a guide into actionable summary

Example: `/distill query:"BIO-RED value chain methodology" domain:BIO-RED`

## Step 1: Gather source nodes

**By query**: `rah_search_nodes(query=<query>, dimensions=[<domain>], limit=10)`

**By IDs**: `rah_get_nodes([id1, id2, ...])`

**By domain (recent)**:
```sql
SELECT n.id, n.title, n.content
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE nd.dimension = '<domain>'
  AND n.created_at > date('now', '-30 days')
ORDER BY n.created_at DESC LIMIT 15
```

**By guide**: `rah_read_guide("<name>")`

## Step 2: Display source list

```
Distilling N nodes:
1. (ID: 42) "BIO-RED Value Chain Methodology" — idea, BIO-RED
2. (ID: 38) "Value chain internal ID tables" — task, BIO-RED
...

Proceed? (yes / remove N / add IDs / cancel)
```

## Step 3: Synthesise

Read the content of all source nodes. Identify:
1. **Core ideas**: the main concepts across these nodes
2. **Patterns**: what appears repeatedly
3. **Gaps**: what's missing or unresolved
4. **Key connections**: how the nodes relate to each other
5. **Actionable conclusions**: what follows from this body of knowledge

## Step 4: Create distillation node

```
rah_add_node:
  title: "Distillation: <topic>"
  dimensions: ["idea", "<domain>"]
  content: |
    # Distillation: <topic>
    Sources: N nodes (IDs: ...)

    ## Core Ideas
    - <idea 1>
    - <idea 2>

    ## Patterns
    - <pattern>

    ## Gaps
    - <open question>

    ## Actionable Conclusions
    - <conclusion>

    ## Key Connections
    - <node A> relates to <node B> via <relationship>
  description: "Synthesis of N nodes on <topic>"
```

## Step 5: Create edges to sources

```
rah_create_edge(distillationId, sourceId, "distilled from")
```
(for each source node)

## Step 6: Offer memory promotion

> "Should any of these conclusions go into the memory guide? (yes/no)"

If yes: update `rah_write_guide("memory", ...)` with new entry.

## Edge cases

- No nodes found: "No nodes found matching '<query>'. Try broader terms."
- Only 1 node: "Only 1 node found — distillation works best with 3+. Continue? (yes/no)"
