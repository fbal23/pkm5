# RA-OS

This is **RA-OS** — a minimal, local-first knowledge graph UI with MCP server integration.

## What is RA-OS?

RA-OS is a stripped-down version of [PKM5](https://pkm5.app) focused on:

- **2-panel UI** for browsing and editing your knowledge graph
- **MCP server** so external AI agents (like Claude Code) can access your notes
- **Local SQLite** database with vector search
- **BYO API keys** — no cloud dependencies

## What's NOT Included

RA-OS intentionally excludes:

- Chat interface (use external agents via MCP)
- Voice features
- Built-in AI agents
- Auth/subscription system
- Desktop packaging (Tauri)

## Relationship to PKM5

This repo (`pkm5`) is derived from the private `pkm5` repository. Shared features (database, UI components, MCP server) are synced from private to public.

## Getting Started

See [README.md](../README.md) for installation.

## Contributing

- **Bug reports** — Open an issue
- **Feature requests** — Open an issue
- **Pull requests** — Welcome for bug fixes and improvements

## License

MIT — See [LICENSE](../LICENSE)
