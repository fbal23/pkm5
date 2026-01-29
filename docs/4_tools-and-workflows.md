# Tools & Workflows

> MCP tools available for external agents and the workflow execution system.

**How it works:** RA-H Light exposes tools via MCP that external AI agents can call to read, create, and update your knowledge graph. Workflows are pre-written instruction sets that can be executed via the `/api/workflows/execute` endpoint.

---

## MCP Tools

RA-H Light provides 11 MCP tools for external agents:

### Node Operations

| Tool | Description |
|------|-------------|
| `rah_add_node` | Create a new knowledge node |
| `rah_search_nodes` | Search nodes by title, content, or dimensions |
| `rah_update_node` | Update an existing node |
| `rah_get_nodes` | Get nodes by ID array |

### Edge Operations

| Tool | Description |
|------|-------------|
| `rah_create_edge` | Create relationship between nodes |
| `rah_query_edges` | Query existing edges |
| `rah_update_edge` | Update edge metadata |

### Dimension Operations

| Tool | Description |
|------|-------------|
| `rah_create_dimension` | Create a new dimension tag |
| `rah_update_dimension` | Update dimension description |
| `rah_delete_dimension` | Delete a dimension |

### Search

| Tool | Description |
|------|-------------|
| `rah_search_embeddings` | Semantic search across chunk embeddings |

---

## Tool Schemas

### rah_add_node

```typescript
{
  title: string,        // Required
  content?: string,
  description?: string,
  dimensions?: string[],
  link?: string,
  metadata?: object
}
```

### rah_search_nodes

```typescript
{
  search?: string,      // Full-text search
  dimensions?: string[],// Filter by dimensions
  limit?: number        // Max results (default: 20)
}
```

### rah_update_node

```typescript
{
  id: number,           // Node ID
  title?: string,
  content?: string,     // Replaces existing content
  description?: string,
  dimensions?: string[],
  link?: string,
  metadata?: object
}
```

### rah_create_edge

```typescript
{
  from_node_id: number,
  to_node_id: number,
  context?: string      // Relationship description
}
```

### rah_search_embeddings

```typescript
{
  query: string,        // Search query
  node_id?: number,     // Scope to specific node
  limit?: number,       // Max results
  threshold?: number    // Similarity threshold (0-1)
}
```

---

## API Routes

RA-H Light exposes REST APIs that MCP tools call internally:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/nodes` | GET/POST | List/create nodes |
| `/api/nodes/[id]` | GET/PUT/DELETE | Node CRUD |
| `/api/nodes/search` | POST | Search nodes |
| `/api/edges` | GET/POST | List/create edges |
| `/api/edges/[id]` | GET/PUT/DELETE | Edge CRUD |
| `/api/dimensions` | GET/POST | List/create dimensions |
| `/api/dimensions/search` | GET | Search dimensions |
| `/api/workflows/execute` | POST | Execute workflow |

---

## Workflows

Workflows are pre-written instruction sets stored in `~/Library/Application Support/RA-H/workflows/`.

### Workflow Format

```json
{
  "key": "integrate",
  "displayName": "Integrate",
  "description": "Deep analysis and connection-building for focused node",
  "instructions": "You are executing the INTEGRATE workflow...",
  "enabled": true,
  "requiresFocusedNode": true
}
```

### Executing Workflows

Via API:
```bash
curl -X POST http://localhost:3000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{"workflow_key": "integrate", "focused_node_id": 123}'
```

### Built-in Workflows

**Integrate** — Database-wide connection discovery. Finds related nodes and suggests connections.

### Creating Custom Workflows

1. Create a JSON file in `~/Library/Application Support/RA-H/workflows/`
2. Define key, displayName, description, instructions
3. Set `enabled: true`
4. Execute via API

---

## Database Tools (Internal)

These tools are used by the workflow executor and API routes:

| Tool | File | Purpose |
|------|------|---------|
| `queryNodes` | `src/tools/database/queryNodes.ts` | Search nodes |
| `createNode` | `src/tools/database/createNode.ts` | Create node |
| `updateNode` | `src/tools/database/updateNode.ts` | Update node |
| `deleteNode` | `src/tools/database/deleteNode.ts` | Delete node |
| `getNodesById` | `src/tools/database/getNodesById.ts` | Get by ID |
| `createEdge` | `src/tools/database/createEdge.ts` | Create edge |
| `updateEdge` | `src/tools/database/updateEdge.ts` | Update edge |
| `queryEdge` | `src/tools/database/queryEdge.ts` | Query edges |
| `queryDimensions` | `src/tools/database/queryDimensions.ts` | Query dimensions |
| `searchContentEmbeddings` | `src/tools/other/searchContentEmbeddings.ts` | Semantic search |

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/mcp-server/server.js` | HTTP MCP server |
| `apps/mcp-server/stdio-server.js` | STDIO MCP server |
| `src/tools/infrastructure/registry.ts` | Tool registry |
| `src/services/agents/workflowExecutor.ts` | Workflow execution |
