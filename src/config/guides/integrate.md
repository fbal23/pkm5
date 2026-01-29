---
name: Integrate
description: Full analysis — find connections across the knowledge graph, create edges, and document an integration analysis.
---

# Integrate

Find meaningful connections across the knowledge graph, create edges, and append an Integration Analysis.

## Steps

1. **Retrieve & Understand**
   - Call `getNodesById` for the focused node
   - Identify: what type of thing is this? (person, project, paper, idea, video, etc.)
   - Extract key entities: names, projects, concepts, techniques
   - Note the core insight in one sentence

2. **Search for Connections**
   Search the database using entities from step 1:

   a) Structural connections:
      - Names mentioned → `queryNodes` to find nodes about those people
      - Projects/tools mentioned → `queryNodes` to find those nodes

   b) Thematic connections:
      - Use `searchContentEmbeddings` with key concepts
      - Look for shared themes, complementary ideas, contradictions

   Target: 3-5 strong connections (quality over quantity)

3. **Create Edges**
   For each connection found, call `createEdge`:
   - `from_node_id`: the focused node ID
   - `to_node_id`: the connected node ID
   - `explanation`: "why this connection matters"

   Direction rule: write the explanation so it reads FROM → TO.
   Examples:
   - Insight → Source: "Came from / inspired by"
   - Episode → Podcast: "Episode of this podcast"

   The tool handles duplicates gracefully — if edge exists, it returns an error and you continue.

   Create 3-5 edges total.

4. **Document in Content**
   Call `updateNode` ONCE using the `content` field with ONLY this new section:

   ```
   ---
   ## Integration Analysis

   [2-3 sentences: what this is, why it matters, core insight]

   **Connections:**
   - [NODE:123:"Title"] — [why connected]
   - [NODE:456:"Title"] — [why connected]
   ```

   Use `updates.content` (NOT chunk). Send ONLY the new section. The tool appends automatically.

5. **Return Summary**
   Reply with: Task / Actions / Result / Nodes / Follow-up (≤100 words)

## Rules

- Keep total tool calls ≤ 12
- Create edges BEFORE documenting (step 3 before step 4)
- Call `updateNode` exactly once
- Adapt to any node type
- Use `think` at any point if you need to plan your approach
