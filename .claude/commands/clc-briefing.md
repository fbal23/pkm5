# /clc-briefing — CLC domain briefing

Generate a briefing on the competitive/consortium landscape for a domain by loading org nodes, people, recent clippings, and relationship edges.

## Input

Arguments: `$ARGUMENTS`

- Domain name (e.g. `EIT Water`, `BIO-RED`) — required
- `depth:<n>` → how many relationship hops to include (default 1)

## Step 1: Load org nodes for domain

```sql
SELECT n.id, n.title, n.content, n.metadata,
  GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'org')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = '<domain>')
GROUP BY n.id ORDER BY n.title
```

## Step 2: Load people in domain

```sql
SELECT n.id, n.title, n.metadata
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'person')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = '<domain>')
GROUP BY n.id ORDER BY json_extract(n.metadata, '$.last') DESC NULLS LAST
```

## Step 3: Load recent clippings (last 30 days)

```sql
SELECT n.id, n.title, json_extract(n.metadata, '$.from') AS sender,
  json_extract(n.metadata, '$.subject') AS subject
FROM nodes n JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'clipping')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = '<domain>')
  AND n.created_at > date('now', '-30 days')
GROUP BY n.id ORDER BY n.created_at DESC LIMIT 10
```

## Step 4: Load relationship edges between orgs

```
rah_query_edges(nodeId=<org1_id>)
```
Collect all org-to-org edges in the domain.

## Step 5: Render briefing

```
══════════════════════════════════════════════════
  CLC BRIEFING — <Domain>  [2026-02-22]
══════════════════════════════════════════════════

## Organisations (N)
| Name | Type | Role | Last Contact |
|------|------|------|-------------|
| EIT Water | consortium | lead | 2026-02-20 |
| BRYCK | partner | implementer | 2026-02-18 |

## Key People (N)
| Name | Role | Org | Last Interaction |
|------|------|-----|-----------------|
| Alison Cavey | Programme Manager | EIT Water | 2026-02-20 |

## Relationship Map
- EIT Water → BRYCK: partners in EIT programme
- ...

## Recent Clippings (last 30 days, N)
- "Draft ToR for SB" from Alison Cavey (2026-01-26)
- ...

## Open Commitments in Domain (N)
- Commitment title — due YYYY-MM-DD
```

## Step 6: Memory check

`rah_read_guide("memory")` — show any Domain Dynamics entries for this domain.

## Edge cases

- Domain not found: "No nodes found for domain '<domain>'. Check dimension name."
- No orgs: "No org nodes in <domain>. Run `/new org` to create them."
