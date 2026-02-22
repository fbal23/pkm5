# PKM5 OS

```
 ██████╗  █████╗       ██╗  ██╗
 ██╔══██╗██╔══██╗      ██║  ██║
 ██████╔╝███████║█████╗███████║
 ██╔══██╗██╔══██║╚════╝██╔══██║
 ██║  ██║██║  ██║      ██║  ██║
 ╚═╝  ╚═╝╚═╝  ╚═╝      ╚═╝  ╚═╝
```

**TL;DR:** Clone this repository and you'll have a local SQLite database on your computer. The database schema is structured so external AI agents can continuously read and write to it, building your knowledge graph externally.

[![Watch the demo](https://img.youtube.com/vi/IA02YB8mInM/hqdefault.jpg)](https://youtu.be/IA02YB8mInM?si=WoWpNE9QZEKEukvZ)

> **Currently macOS only.** Linux and Windows support is coming. If you want to run it on Linux/Windows now, see [instructions at the bottom](#linuxwindows).

**Full documentation:** [pkm5.app/docs/open-source](https://pkm5.app/docs/open-source)

---

## What This Does

1. **Stores knowledge locally** — Notes, bookmarks, ideas, research in a SQLite database on your machine
2. **Provides a UI** — Browse, search, and organize your nodes at `localhost:3000`
3. **Exposes an MCP server** — Claude Code, Cursor, or any MCP client can query and add to your knowledge base

Your data stays on your machine. Nothing is sent anywhere unless you configure an API key.

---

## Requirements

- **Node.js 20.18.1+** — [nodejs.org](https://nodejs.org/)
- **macOS** — Works out of the box
- **Linux/Windows** — Requires building sqlite-vec manually (see below)

---

## Install

```bash
git clone https://github.com/bradwmorris/pkm5.git
cd pkm5
npm install
npm rebuild better-sqlite3
./scripts/dev/bootstrap-local.sh
npm run dev
```

Open [localhost:3000](http://localhost:3000). Done.

---

## OpenAI API Key

**Optional but recommended.** Without a key, you can still create and organize nodes manually.

With a key, you get:
- Auto-generated descriptions when you add nodes
- Automatic dimension/tag assignment
- Semantic search (find similar content, not just keyword matches)

**Cost:** Less than $0.10/day for heavy use. Most users spend $1-2/month.

**Setup:** The app will prompt you on first launch, or go to Settings → API Keys.

Get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

---

## Where Your Data Lives

```
~/Library/Application Support/PKM5/db/pkm5.sqlite   # macOS
~/.local/share/PKM5/db/pkm5.sqlite                  # Linux
%APPDATA%/PKM5/db/pkm5.sqlite                       # Windows
```

This is a standard SQLite file. You can:
- Back it up by copying the file
- Query it directly with `sqlite3` or any SQLite tool
- Move it between machines

---

## Connect Claude Code (or other MCP clients)

Add to your `~/.claude.json`:

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

Restart Claude Code fully (**Cmd+Q on Mac**, not just closing the window).

**Verify it worked:** Ask Claude "Do you have pkm5_ tools available?" — you should see tools like `pkm5_add_node`, `pkm5_search_nodes`, etc.

**For contributors** testing local changes, use the local path instead:
```json
{
  "mcpServers": {
    "pkm5": {
      "command": "node",
      "args": ["/absolute/path/to/pkm5/apps/mcp-server-standalone/index.js"]
    }
  }
}
```

**What happens:** Once connected, Claude calls `pkm5_get_context` first to orient itself (stats, hub nodes, dimensions, available guides). It proactively captures knowledge — when a new insight, decision, person, or reference surfaces, it proposes a specific node (title, dimensions, description) so you can approve with minimal friction. For complex tasks it reads guides to understand your graph conventions and custom workflows.

Available tools:

| Tool | What it does |
|------|--------------|
| `pkm5_get_context` | Get graph overview — stats, hub nodes, dimensions, recent activity |
| `pkm5_search_nodes` | Find nodes by keyword |
| `pkm5_add_node` | Create a new node |
| `pkm5_get_nodes` | Fetch nodes by ID |
| `pkm5_update_node` | Edit an existing node |
| `pkm5_create_edge` | Link two nodes together |
| `pkm5_update_edge` | Update an edge explanation |
| `pkm5_query_edges` | Find connections |
| `pkm5_list_dimensions` | List all tags/categories |
| `pkm5_create_dimension` | Create a new dimension |
| `pkm5_update_dimension` | Update/rename a dimension |
| `pkm5_delete_dimension` | Delete a dimension |
| `pkm5_list_guides` | List available guides (system + custom) |
| `pkm5_read_guide` | Read a guide by name |
| `pkm5_write_guide` | Create or update a custom guide |
| `pkm5_delete_guide` | Delete a custom guide |
| `pkm5_search_content` | Search through source content (transcripts, books, articles) |
| `pkm5_sqlite_query` | Run read-only SQL queries (SELECT/WITH/PRAGMA) |

**Example prompts for Claude Code:**
- "What's in my knowledge graph?"
- "Search my knowledge base for notes about React performance"
- "Add a node about the article I just read on transformers"
- "What nodes are connected to my 'research' dimension?"

---

## Direct Database Access

Query your database directly:

```bash
# Open the database
sqlite3 ~/Library/Application\ Support/PKM5/db/pkm5.sqlite

# List all nodes
SELECT id, title, created_at FROM nodes ORDER BY created_at DESC LIMIT 10;

# Search by title
SELECT title, description FROM nodes WHERE title LIKE '%react%';

# Find connections
SELECT n1.title, e.explanation, n2.title
FROM edges e
JOIN nodes n1 ON e.from_node_id = n1.id
JOIN nodes n2 ON e.to_node_id = n2.id
LIMIT 10;
```

See [pkm5.app/docs/open-source](https://pkm5.app/docs/open-source) for full schema documentation.

---

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the app at localhost:3000 |
| `npm run build` | Production build |
| `npm run type-check` | Check TypeScript |

---

## Linux/Windows

The repo ships with a macOS binary for sqlite-vec (`vendor/sqlite-extensions/vec0.dylib`). On Linux or Windows you need to swap it for your platform's version.

**Linux:**

1. Go to [sqlite-vec releases](https://github.com/asg017/sqlite-vec/releases)
2. Download the release matching your architecture (e.g. `sqlite-vec-0.1.6-loadable-linux-x86_64.tar.gz`)
3. Extract `vec0.so` from the archive
4. Copy it to `vendor/sqlite-extensions/vec0.so` in this repo
5. Run the normal install steps above

**Windows:**

1. Go to [sqlite-vec releases](https://github.com/asg017/sqlite-vec/releases)
2. Download the Windows release (e.g. `sqlite-vec-0.1.6-loadable-windows-x86_64.zip`)
3. Extract `vec0.dll` from the archive
4. Copy it to `vendor/sqlite-extensions/vec0.dll` in this repo
5. Run the normal install steps above

Without sqlite-vec, everything works except semantic/vector search.

---

## More

- **Full docs:** [pkm5.app/docs/open-source](https://pkm5.app/docs/open-source)
- **Issues:** [github.com/bradwmorris/pkm5/issues](https://github.com/bradwmorris/pkm5/issues)
- **License:** MIT
