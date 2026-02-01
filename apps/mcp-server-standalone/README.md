# RA-H MCP Server

Connect Claude Code and Claude Desktop to your RA-H knowledge base. Direct SQLite access - works without the RA-H app running.

## Install

```bash
npx ra-h-mcp-server
```

That's it. No manual setup required.

## Configure Claude Code / Claude Desktop

Add to your Claude config (`~/.claude.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "ra-h": {
      "command": "npx",
      "args": ["ra-h-mcp-server"]
    }
  }
}
```

Restart Claude. Done.

## Requirements

- Node.js 18+
- RA-H database at `~/Library/Application Support/RA-H/db/rah.sqlite`
  - Run the RA-H desktop app once to create it

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RAH_DB_PATH` | ~/Library/Application Support/RA-H/db/rah.sqlite | Database path |

## Available Tools

| Tool | Description |
|------|-------------|
| `rah_add_node` | Create a new node |
| `rah_search_nodes` | Search nodes by keyword |
| `rah_get_nodes` | Load nodes by ID |
| `rah_update_node` | Update an existing node |
| `rah_create_edge` | Create connection between nodes |
| `rah_query_edges` | Find edges for a node |
| `rah_list_dimensions` | List all dimensions |
| `rah_create_dimension` | Create a dimension |
| `rah_update_dimension` | Update/rename a dimension |
| `rah_delete_dimension` | Delete a dimension |

## What's NOT Included

This is a lightweight CRUD server. Advanced features are handled by the main app:

- Embedding generation
- AI-powered edge inference
- Content extraction (URL, YouTube, PDF)
- Real-time SSE events

## Testing

```bash
# Test database connection
node -e "const {initDatabase,query}=require('./services/sqlite-client');initDatabase();console.log(query('SELECT COUNT(*) as c FROM nodes')[0].c,'nodes')"

# Run the server
node index.js
```
