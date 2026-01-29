# RA-H Light

This is **RA-H Light** — a minimal, local-first knowledge graph UI with MCP server integration.

## What is RA-H Light?

RA-H Light is a stripped-down version of [RA-H](https://ra-h.app) focused on:

- **2-panel UI** for browsing and editing your knowledge graph
- **MCP server** so external AI agents (like Claude Code) can access your notes
- **Local SQLite** database with vector search
- **BYO API keys** — no cloud dependencies

## What's NOT Included

RA-H Light intentionally excludes:

- Chat interface (use external agents via MCP)
- Voice features
- Built-in AI agents
- Auth/subscription system
- Desktop packaging (Tauri)

## Relationship to RA-H

This repo (`ra-h_os`) is derived from the private `ra-h` repository. Shared features (database, UI components, MCP server) are synced from private to public.

## Getting Started

See [README.md](../README.md) for installation.

## Contributing

- **Bug reports** — Open an issue
- **Feature requests** — Open an issue
- **Pull requests** — Welcome for bug fixes and improvements

## License

MIT — See [LICENSE](../LICENSE)
