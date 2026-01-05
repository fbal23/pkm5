# RA-H Open Source

A local-first AI research workspace. Full 3-panel interface, vector search, content ingestion, workflows, and conversation agents. BYO API keys, no cloud dependencies.

**Full Documentation:** [ra-h.app/docs](https://ra-h.app/docs)

## Platform Support

| Platform | Status |
|----------|--------|
| macOS (Apple Silicon) | ✅ Supported |
| macOS (Intel) | ✅ Supported |
| Linux | 🚧 Coming (requires manual sqlite-vec build) |
| Windows | 🚧 Coming (requires manual sqlite-vec build) |

## Quick Start

```bash
git clone https://github.com/bradwmorris/ra-h_os.git
cd ra-h_os
npm install
npm rebuild better-sqlite3
scripts/dev/bootstrap-local.sh
npm run dev
```

Open http://localhost:3000 → **Settings → API Keys** → add your OpenAI/Anthropic keys.

## Features

- **3-Panel interface** – Nodes, focus, and chat in one view
- **BYO keys** – Your Anthropic/OpenAI keys only; nothing sent to RA-H
- **Local SQLite + sqlite-vec** – Semantic search and embeddings on your machine
- **Content extraction** – YouTube, PDF, web pipelines included
- **Workflows** – Editable JSON workflows for common tasks
- **MCP Server** – Connect Claude Code, ChatGPT, or any MCP-compatible assistant

## Project Layout

```
app/                 Next.js App Router
src/
  components/        UI
  services/          Agents, embeddings, ingestion, storage
  tools/             Agent tools
  config/            Prompts, workflows
apps/mcp-server/     MCP server for external AI assistants
docs/                Local docs (mirrors ra-h.app/docs)
scripts/             Dev helpers
vendor/              Pre-built binaries (sqlite-vec, yt-dlp)
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server at localhost:3000 |
| `npm run build` | Production build |
| `npm run type-check` | TypeScript validation |
| `npm run sqlite:backup` | Database snapshot |
| `npm run sqlite:restore` | Restore from backup |

## Documentation

**Primary:** [ra-h.app/docs](https://ra-h.app/docs)

Local reference:
- [docs/0_overview.md](docs/0_overview.md) – Overview
- [docs/1_architecture.md](docs/1_architecture.md) – Architecture
- [docs/2_schema.md](docs/2_schema.md) – Database schema
- [docs/8_mcp.md](docs/8_mcp.md) – MCP server setup
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) – Common issues

## Linux/Windows Setup

The bundled `sqlite-vec` and `yt-dlp` binaries are macOS-only. For other platforms:

**sqlite-vec** (required for vector search):
1. Clone https://github.com/asg017/sqlite-vec
2. Build for your platform
3. Place at `vendor/sqlite-extensions/vec0.so` (Linux) or `vec0.dll` (Windows)
4. Set `SQLITE_VEC_EXTENSION_PATH` in `.env.local`

**yt-dlp** (required for YouTube extraction):
1. Download from https://github.com/yt-dlp/yt-dlp/releases
2. Place at `vendor/bin/yt-dlp`
3. `chmod +x vendor/bin/yt-dlp` (Linux)

Without sqlite-vec: UI, node CRUD, basic search, chat, and content extraction still work. Vector/semantic search requires it.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](LICENSE)
