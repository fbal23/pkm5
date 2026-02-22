# /parse-clc — Parse CLC-specific content into PKM5 nodes

Process CLC (Competitive Landscape / Consortium) content and create structured nodes for companies, people, and relationships encountered.

## Input

Arguments: `$ARGUMENTS`

- Paste raw CLC content, or
- Provide a clipping node ID (`id:<n>`)
- Or search for CLC clippings: `search`

## Step 1: Identify source content

If ID given: `pkm5_get_nodes([id])` to load content.
If `search`: `pkm5_search_nodes(query="CLC", limit=10)` to find CLC-tagged nodes.
If raw text: use directly.

## Step 2: Extract entities

From the CLC content, identify:
1. **Companies/organisations**: names, types, roles in consortium
2. **People**: names, roles, affiliations
3. **Projects/grants**: reference numbers, titles, funding amounts
4. **Relationships**: partnerships, funding relationships, competition

## Step 3: Resolve against existing nodes

For each company/person:
```
pkm5_search_nodes(query="<name>", dimensions=["org"/"person"], limit=2)
```

Classify each as: resolved (existing) | new (create)

## Step 4: Create or update nodes

**New org**:
```
pkm5_add_node:
  title: "<Company Name>"
  dimensions: ["org", "<domain>"]
  metadata: { org-type: "partner/competitor/funder", aliases: ["<abbrev>"] }
  description: "<What this org does + why it matters to us>"
```

**New person**:
```
pkm5_add_node:
  title: "<Full Name>"
  dimensions: ["person", "<domain>"]
  metadata: { org: "<org name>", role: "<role>", cited: 1 }
```

**Update existing** (if new info found): `pkm5_update_node` with updated metadata.

## Step 5: Create relationship edges

```
pkm5_create_edge(personId, orgId, "works at")
pkm5_create_edge(org1Id, org2Id, "partners with in <project>")
pkm5_create_edge(orgId, clippingId, "mentioned in")
```

## Step 6: Mark source as processed

If source was a clipping node:
```
pkm5_update_node(sourceId, updates={
  dimensions: ["clipping", "<domain>", "active"]  // remove 'pending'
})
```

## Step 7: Summary

```
CLC parsing complete:
  Orgs: N created, M updated
  People: N created, M updated
  Edges: N created
  Source: marked as processed
```

## Edge cases

- Ambiguous organisation name (common abbreviation): show options, ask user to select
- Person already exists with different role: show diff and ask to update or keep
- No CLC content identified: "Could not identify CLC entities in this content."
