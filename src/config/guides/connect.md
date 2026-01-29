---
name: Connect
description: Quick link — find explicitly related nodes and create edges between them.
---

# Connect

Quick link: find explicitly related nodes and create edges.

## Steps

1. **Read Node**
   Call `getNodesById` for the focused node. Extract the main topic/subject from the title.

2. **Quick Search**
   Call `queryNodes` with the main topic from the node title.
   - `search`: the key term from the title (e.g., if title mentions "Nietzsche", search "Nietzsche")
   - `limit`: 10
   - Do NOT add dimensions filter — search across all nodes

3. **Create Edges**
   From results, pick 2-4 clearly related nodes.
   Call `createEdge` for each:
   - `from_node_id`: focused node ID
   - `to_node_id`: related node ID
   - `explanation`: "brief reason for this connection"

   Direction rule: write the explanation so it reads FROM → TO.
   Examples:
   - Episode → Podcast: "Episode of this podcast"
   - Book → Author: "Written by"

4. **Done**
   Reply: "Linked [NODE:id:title] → [list of connected nodes as NODE:id:title]"

## Rules

- Total tool calls ≤ 5
- Search the MAIN TOPIC from the title, not random names from content
- NO dimensions filter in `queryNodes` — search everything
- Only link nodes with clear relationships
- Skip if no matches found
