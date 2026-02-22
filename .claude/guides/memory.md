---
name: memory
description: Curated PKM memory — proven insights, relationship patterns, workflow knowledge, domain expertise, red flags, and lessons learned. Ported from PKM_2026/memory/MEMORY.md.
---

# PKM Memory

Curated knowledge that has been tested and validated through real experience. Only add entries here when the insight has proven durable. Use `pkm5_add_node` with dimension `insight` for new candidates — promote to this guide after the next weekly review.

---

## Domain Dynamics

Observations about organizational behavior, decision patterns, power dynamics, and governance culture across domains and companies.

*(Populate from experience — no entries yet as of migration 2026-02-22)*

---

## Relationships

Key stakeholder connections, communication patterns, trust levels, and interaction history. Who influences whom, and how relationships evolve over time.

*(Populate from meeting notes and post-meeting processing)*

---

## Workflow Patterns

Recurring processes that work well or poorly. Tools, habits, and sequences that improve productivity. What compounds across cycles.

*(Populate as patterns are observed across weekly reviews)*

---

## Domain Knowledge

Technical and industry expertise captured from work. Company specifics, regulatory context, market dynamics, and sector knowledge.

### Paperless-ngx API (2026-02-03)

- `POST /api/documents/post_document/` returns a **bare UUID string** (e.g. `"abc-123"`), not `{"task_id": "abc-123"}`. `json.loads()` produces a Python `str`. Always check `isinstance(result, str)` before calling `.get()`.
- Upload is async: POST returns task UUID → poll `GET /api/tasks/?task_id=UUID` until `status == "SUCCESS"` → read `related_document` for the doc ID.
- `DELETE /api/documents/{id}/` moves to **trash**, not permanent delete. Trash docs still trigger duplicate detection on re-upload.
- Empty trash: `POST /api/trash/empty/` with body `{"action": "empty"}`. Returns `{"result": "OK", "doc_ids": [...]}`.
- Multiple tags on upload: send **repeated** `tags` form fields in multipart body (one per tag ID), not a comma-separated list.
- Correspondents and tags support find-or-create: `GET /api/correspondents/?page_size=1000` to list, `POST /api/correspondents/` with `{"name": "..."}` to create. Same for `/api/tags/`. Cache the name→ID map per session.
- Metadata fields accepted by `post_document`: `title`, `correspondent` (ID), `tags` (repeated IDs), `created` (YYYY-MM-DD).

---

## Personal Preferences

Working style, formatting preferences, timing habits, and communication style. What makes work easier and more effective.

*(Populate from daily-review and weekly-review reflections)*

---

## Red Flags

Warning signs and patterns to watch for. Behaviors, situations, or signals that have preceded problems in the past.

*(Populate from experience)*

---

## Lessons Learned

Dated insights from specific experiences. What worked, what didn't, and why. Each entry tied to a concrete event.

### 2026-02-03: Direct Paperless Upload Implementation

- **What worked**: Self-contained upload functions using only stdlib. No dependency on vault venv or Atlas framework. Token read from `~/.config/pkm/paperless_token` (file, not env var) because Automator Quick Actions don't inherit `~/.zshrc`.
- **What didn't**: Assumed Paperless API returned JSON objects everywhere — bare UUID string from `post_document` broke `.get()` calls. Also assumed DELETE was permanent — had to discover the trash system and empty-trash endpoint through trial and error.
- **Key insight**: Always test API responses with actual calls before writing parsing logic. Paperless docs don't cover all response formats.

---

## PKM5 Usage Notes

- Search this guide: `pkm5_read_guide("memory")`
- Add a new candidate insight as a node: `pkm5_add_node` with dimensions `["insight", "<domain>"]`
- Promote a node to this guide: edit this guide via `pkm5_write_guide("memory", <updated content>)`
- Archive stale insights: remove from this guide + archive the node (add `archived` dimension)
