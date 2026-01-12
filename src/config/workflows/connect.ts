export const CONNECT_WORKFLOW_INSTRUCTIONS = `You are executing the CONNECT workflow for the currently focused node.

MISSION
Quick link: find explicitly related nodes and create edges.

WORKFLOW STEPS

1. READ NODE
   Call getNodesById for the focused node. Extract the main topic/subject from the title.

2. QUICK SEARCH
   Call queryNodes with the main topic from the node title.
   - search: the key term from the title (e.g., if title mentions "Nietzsche", search "Nietzsche")
   - limit: 10
   - DO NOT add dimensions filter - search across all nodes

3. CREATE EDGES
   From results, pick 2-4 clearly related nodes.
   Call createEdge for each:
   - from_node_id: focused node ID
   - to_node_id: related node ID
   - context: { explanation: "brief reason" }

4. DONE
   Reply: "Linked [NODE:id:title] → [list of connected nodes as NODE:id:title]"

RULES
- Total tool calls ≤ 5
- Search the MAIN TOPIC from the title, not random names from content
- NO dimensions filter in queryNodes - search everything
- Only link nodes with clear relationships
- Skip if no matches found`;
