---
name: Start Here
description: Master orientation. Read this first when tasks are ambiguous or complex.
immutable: true
---

# Start Here

This is the user's personal knowledge graph — a local SQLite database of nodes connected by edges, organized into dimensions.

## Nodes

Every piece of knowledge is a node. Key fields:

- **title** — Clear, descriptive, max 160 chars. Should stand alone as a meaningful label.
- **description** — One-sentence summary. Powers search and AI understanding. Auto-generated if omitted.
- **content** — Your notes, analysis, commentary. This is where synthesis lives.
- **chunk** — Verbatim source text (transcript, article body, full quote). Kept separate from your analysis in content.
- **link** — ONLY for external content (URLs, YouTube, articles, PDFs). Omit for ideas, synthesis, or anything derived from existing nodes.
- **dimensions** — 1–5 categories. Always call rah_list_dimensions first and use existing ones.

Two types of nodes:
- **External content** (has link) — articles, videos, papers, tweets. The link points to the source.
- **Synthesis/ideas** (no link) — insights, connections, personal thinking. Create edges back to source nodes instead.

## Edges

Connections between nodes. The most valuable part of the graph — they represent understanding, not proximity.

- Every edge needs an **explanation** — a human-readable sentence explaining WHY this connection exists
- **Direction matters** — reads as: source → [explanation] → target. Example: node "Alice" → "invented this technique" → node "Technique X"
- Edge types are inferred from the explanation — don't set them manually
- Create edges after synthesis, when relationships surface, or when a guide instructs you to

## Dimensions

Categories that organize nodes. Two kinds:

- **Priority (locked)** — core categories the user actively maintains (e.g., "research", "person", "idea", "entity")
- **Non-priority** — secondary tags applied when relevant (e.g., "philosophy", "venture", "ai")
- Naming: lowercase, singular form, concise, no overlapping names
- Every dimension needs a description explaining its purpose
- Check existing dimensions before creating new ones — avoid near-duplicates

## Key Conventions

1. **Search before creating** — always call rah_search_nodes to check for duplicates
2. **Content appends, dimensions replace** — when updating a node, new content is added below existing content; dimensions are fully replaced with the new array
3. **Hub nodes** are the most-connected nodes — they represent the user's major themes and interests
4. **Proactively save valuable information** — when you spot something worth preserving in a conversation, offer to add it
5. **Quality over quantity** — one well-titled, well-connected node is better than five shallow ones

## Guides

There are two kinds of guides available via rah_list_guides:

- **System guides (immutable)** — reference documentation maintained by RA-H. Cover schema, node creation, edges, dimensions, and content extraction. Always available, cannot be modified.
- **User guides (custom)** — created by the user for their own workflows, preferences, and procedures. Can be created, edited, and deleted via rah_write_guide / rah_delete_guide.

Call rah_list_guides to see what's available, then rah_read_guide to load any guide you need.
