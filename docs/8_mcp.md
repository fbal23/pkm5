# MCP Server

> How to connect Claude Code and other AI assistants to your knowledge base.

**How it works:** RA-OS runs a local MCP (Model Context Protocol) server. This lets any MCP-compatible assistant — like Claude Code — search your notes, add new knowledge, and manage your knowledge graph. Everything stays local; nothing goes to the cloud.

---

## Quick Start

1. Start RA-OS: `npm run dev`
2. Configure your AI assistant (see below)
3. Use naturally: "Search RA-H for my notes on X" or "Add this to RA-H"

---

## Available Tools

| Tool | Description |
|------|-------------|
| `rah_add_node` | Create a new node (title/content/dimensions) |
| `rah_search_nodes` | Search existing nodes |
| `rah_update_node` | Update an existing node |
| `rah_get_nodes` | Get nodes by ID |
| `rah_create_edge` | Create relationship between nodes |
| `rah_query_edges` | Query existing edges |
| `rah_update_edge` | Update edge metadata |
| `rah_create_dimension` | Create a new dimension |
| `rah_update_dimension` | Update dimension description |
| `rah_delete_dimension` | Delete a dimension |
| `rah_search_embeddings` | Semantic search across embeddings |

---

## Claude Code Configuration

Add to your `~/.claude.json` or Claude Code settings:

```json
{
  "mcpServers": {
    "ra-h": {
      "command": "node",
      "args": ["/path/to/ra-h_os/apps/mcp-server/stdio-server.js"]
    }
  }
}
```

Replace `/path/to/ra-h_os` with the actual path to your RA-OS installation.

**Note:** RA-OS must be running (`npm run dev`) for the MCP server to work.

---

## HTTP Transport

For assistants that support HTTP transport:

**URL:** `http://127.0.0.1:44145/mcp`

```json
{
  "mcpServers": {
    "ra-h": {
      "url": "http://127.0.0.1:44145/mcp"
    }
  }
}
```

To start the HTTP server standalone:
```bash
node apps/mcp-server/server.js
```

---

## Example Usage

Once connected, you can ask your AI assistant:

```
"Search RA-H for what I wrote about product strategy"
"Add this conversation summary to RA-H as a new node"
"Find all nodes with the 'research' dimension"
"Create an edge between node 123 and node 456"
"What are my most connected nodes?"
```

---

## Security

- The MCP server only binds to `127.0.0.1` — localhost only
- No authentication required (local access only)
- All data persisted to `~/Library/Application Support/RA-H/db/rah.sqlite`

---

## Health Check

```bash
curl http://127.0.0.1:44145/status
```

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/mcp-server/server.js` | HTTP MCP server |
| `apps/mcp-server/stdio-server.js` | STDIO MCP server (for Claude Code) |

---

## Troubleshooting

### "Connection refused"

1. Make sure RA-OS is running: `npm run dev`
2. Check the port isn't blocked: `lsof -i :44145`
3. Verify the server started: check terminal output

### "Tools not showing"

1. Restart your AI assistant after configuring
2. Verify the path in your config is correct
3. Check `node apps/mcp-server/stdio-server.js` runs without errors

### "Permission denied"

1. Make sure the stdio-server.js file is readable
2. Check Node.js is in your PATH
