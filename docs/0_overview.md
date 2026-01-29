# RA-H Light Overview

## What is RA-H Light?

RA-H Light is a minimal knowledge graph UI with MCP server integration. It provides a local-first knowledge management system designed to be extended by external AI agents via the Model Context Protocol.

**Open Source:** [github.com/bradwmorris/ra-h_os](https://github.com/bradwmorris/ra-h_os)

## Design Philosophy

**Local-first** — Your knowledge network belongs to you. Everything runs locally in a SQLite database you control.

**Agent-agnostic** — No built-in AI chat. Instead, RA-H Light exposes an MCP server that any AI agent (Claude Code, custom agents) can connect to.

**Simple & focused** — 2-panel UI for browsing and editing your knowledge graph. No bloat.

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Database:** SQLite + sqlite-vec (vector search)
- **Embeddings:** OpenAI (BYO API key)
- **MCP Server:** Local connector for Claude Code and external agents

## What's Included

- 2-panel UI (nodes list + focus panel)
- Node/Edge/Dimension CRUD
- Full-text and semantic search
- MCP server with 11 tools
- Workflows system
- PDF extraction
- Graph visualization (Map view)
- BYO API keys

## What's NOT Included

- Chat interface (use external agents via MCP)
- Voice features
- Built-in AI agents
- Auth/subscription system
- Desktop packaging

## Two-Panel Layout

```
┌─────────────┬─────────────────────────┐
│   NODES     │        FOCUS            │
│   Panel     │        Panel            │
│             │                         │
│ • Search    │ • Node content          │
│ • Filters   │ • Connections           │
│ • List      │ • Dimensions            │
│             │                         │
└─────────────┴─────────────────────────┘
```

## MCP Integration

RA-H Light is designed to be the knowledge backend for your AI workflows:

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

Available tools: `rah_add_node`, `rah_search_nodes`, `rah_update_node`, `rah_get_nodes`, `rah_create_edge`, `rah_query_edges`, `rah_update_edge`, `rah_create_dimension`, `rah_update_dimension`, `rah_delete_dimension`, `rah_search_embeddings`

## Documentation

| Doc | Description |
|-----|-------------|
| [Schema](./2_schema.md) | Database schema, node/edge structure |
| [Tools & Workflows](./4_tools-and-workflows.md) | Available MCP tools, workflow system |
| [UI](./6_ui.md) | Component structure, panels, views |
| [MCP](./8_mcp.md) | External agent connector setup |
| [Troubleshooting](./TROUBLESHOOTING.md) | Common issues and fixes |
