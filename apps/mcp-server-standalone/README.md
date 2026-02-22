# PKM5 MCP Server

Connect Claude Code and Claude Desktop to your PKM5 knowledge base. Direct SQLite access - works without the PKM5 app running.

## Install

```bash
npx pkm5-mcp-server
```

That's it. No manual setup required.

## Configure Claude Code / Claude Desktop

Add to your Claude config (`~/.claude.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "pkm5": {
      "command": "npx",
      "args": ["pkm5-mcp-server"]
    }
  }
}
```

Restart Claude. Done.

## Requirements

- Node.js 18+
- Database is created automatically at `~/Library/Application Support/PKM5/db/pkm5.sqlite` on first connection

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PKM5_DB_PATH` | ~/Library/Application Support/PKM5/db/pkm5.sqlite | Database path |

## What to Expect

Once connected, Claude will:
- **Call `pkm5_get_context` first** to orient itself (stats, hub nodes, dimensions, guides)
- **Proactively capture knowledge** — when a new insight, decision, person, or reference surfaces, it proposes a specific node (title, dimensions, description) so you can approve with minimal friction
- **Read guides for complex tasks** — system guides (immutable) teach it how your graph works; custom guides teach it your workflows
- **Search before creating** to avoid duplicates

## Available Tools

| Tool | Description |
|------|-------------|
| `pkm5_get_context` | Get graph overview — stats, hub nodes, dimensions, recent activity |
| `pkm5_add_node` | Create a new node |
| `pkm5_search_nodes` | Search nodes by keyword |
| `pkm5_get_nodes` | Load nodes by ID (includes chunk + metadata) |
| `pkm5_update_node` | Update an existing node |
| `pkm5_create_edge` | Create connection between nodes |
| `pkm5_update_edge` | Update an edge explanation |
| `pkm5_query_edges` | Find edges for a node |
| `pkm5_list_dimensions` | List all dimensions |
| `pkm5_create_dimension` | Create a dimension |
| `pkm5_update_dimension` | Update/rename a dimension |
| `pkm5_delete_dimension` | Delete a dimension |
| `pkm5_list_guides` | List available guides (system + custom) |
| `pkm5_read_guide` | Read a guide by name |
| `pkm5_write_guide` | Create or update a custom guide |
| `pkm5_delete_guide` | Delete a custom guide |
| `pkm5_search_content` | Search through source content (transcripts, books, articles) |
| `pkm5_sqlite_query` | Execute read-only SQL queries (SELECT/WITH/PRAGMA) |

## Guides

Guides are detailed instruction sets that teach Claude how to work with your knowledge base. System guides (schema, creating-nodes, edges, dimensions, extract) are bundled and immutable. You can create up to 10 custom guides for your own workflows.

Guides are stored at `~/Library/Application Support/PKM5/guides/` and shared with the main app.

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
