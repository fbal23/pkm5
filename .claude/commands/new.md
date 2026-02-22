# /new — Create a linked entity from natural language

Parse natural language and create a typed node in RA-H with appropriate dimensions, metadata, and edges to related nodes. More thorough than `/quick` — supports all entity types.

## Input

Arguments: `$ARGUMENTS`

Format: `[type:] <description> [domain:<name>] [due:<date>] [project:<name>] [org:<name>]`

Types: `task`, `project`, `idea`, `commitment`, `person`, `org`, `meeting`, `clipping`

Examples:
- `/new task Review HAC26 proposal by Friday domain:HAC26`
- `/new project Redesign ClaimMore onboarding outcome:"User can complete signup in <3 minutes" domain:ClaimMore`
- `/new person Anna Kovacs role:Programme Manager org:EIT Water domain:EIT Water`
- `/new idea Local LLM routing based on node confidentiality flag domain:AI_development`
- `/new commitment Submit BIO-RED milestone report due:2026-03-31 domain:BIO-RED`

## Step 1: Parse type and fields

If type is explicit (`task:`, `project:`, etc.) — use it.
If not, infer from context:
- Contains due date + action verb → `task`
- Contains "project", "initiative" → `project`
- Contains person name + role/org → `person`
- Contains "idea", "hypothesis", "what if" → `idea`
- Contains "promised", "committed", "deadline" → `commitment`
- Contains org name → `org`

## Step 2: Search for related nodes

Before creating, search for:
- Matching project (if `project:X` given) → get project node ID
- Matching org (if `org:X` given) → get org node ID
- Matching person (if `person` type and person name given)

Use `rah_search_nodes` with relevant dimensions.

## Step 3: Create the node

**task / commitment**:
```
dimensions: ["task"/"commitment", "<domain>", "pending"]
metadata: { due, project (if found) }
```

**project**:
```
dimensions: ["project", "<domain>", "active"]
metadata: { outcome }
description: "Project: <outcome or description>"
```

**person**:
```
dimensions: ["person", "<domain>"]
metadata: { org, role, emails, cited: 0, last: today }
```

**org**:
```
dimensions: ["org", "<domain>"]
metadata: { org-type, aliases }
```

**idea**:
```
dimensions: ["idea", "<domain>"]
description: <the idea distilled>
```

**clipping**:
```
dimensions: ["clipping", "<domain>", "pending"]
metadata: { source, from, subject }
```

## Step 4: Create edges

- Task → Project: `rah_create_edge(taskId, projectId, "is part of project")`
- Person → Org: `rah_create_edge(personId, orgId, "works at")`
- Commitment → relevant org/person: `rah_create_edge(commitmentId, orgId/personId, "committed to")`

## Step 5: Confirm

```
✓ Created <type> (ID: N): "<title>"
  Domain: <domain> | Dimensions: [task, BIO-RED, pending]
  Due: <date> | Project: <project name> (linked)
  Edges created: N
```

## Edge cases

- Ambiguous type: ask once before creating
- Related nodes not found: create without edge, note what was missing
- Person already exists: offer to update instead of creating duplicate
