# /meeting-prep — Prepare for any meeting by loading participant and org context

Load participant profiles, org context, open commitments, past meetings, related notes, and Paperless documents before a meeting. Search axis is **participants** — org context is derived.

## Input

Arguments: `$ARGUMENTS`

Parse:
- Empty → interactive prompt
- Comma-separated names (e.g. "Alice, Bob") → pre-populate participants
- Matches a domain name (e.g. "EIT Water") → org-only prep (backward compatible with `/board-prep`)
- Free text / invitation paste → extract participants and topic

## Step 1: Gather meeting context

### Interactive (no args):
Ask: "Who's attending? (names, comma-separated — or paste invitation text)"

### Pre-populated from args:
Confirm: "Preparing for meeting with: **Name1, Name2**. Correct?"

## Step 2: Resolve participants

For each participant name, search PKM5:
```
pkm5_search_nodes(query="<name>", dimensions=["person"], limit=3)
```

Report:
- **Resolved**: Name — Role at Org (last interaction, strength from metadata)
- **Unresolved**: Name — not in graph

For unresolved, offer: "Create person stub for **Name**?" → if yes, use `/new person <Name> domain:<inferred>`

## Step 3: Load org context

For each resolved participant, get their org from `metadata.org`:
```
pkm5_search_nodes(query="<org name>", dimensions=["org"], limit=1)
```

Load the org node content for context.

## Step 4: Load related data (parallel queries)

### Open commitments
```sql
SELECT n.id, n.title,
  json_extract(n.metadata, '$.due') AS due,
  json_extract(n.metadata, '$.confidential') AS confidential,
  GROUP_CONCAT(nd.dimension, '|') AS dimensions
FROM nodes n
JOIN node_dimensions nd ON nd.node_id = n.id
WHERE n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = 'commitment')
  AND n.id IN (SELECT node_id FROM node_dimensions WHERE dimension IN ('pending','active'))
  AND (n.id IN (SELECT node_id FROM node_dimensions WHERE dimension = '<domain>'))
ORDER BY due ASC NULLS LAST
```

### Past meetings with these participants
Use `pkm5_search_nodes` with query = participant names, dimensions = `["meeting"]`.
Cross-reference edges: find meetings where attendees include these person node IDs.

### Related tasks
```
pkm5_search_nodes(query="<participant names> OR <org name>", dimensions=["task"], limit=5)
```

### Memory mentions
```
pkm5_read_guide("memory")
```
Scan for mentions of participant names / org names.

## Step 5: Display context

### Participant Profiles
| Name | Role | Org | Last Interaction | Strength |
|------|------|-----|-----------------|----------|

### Org Context
For each org: content summary (key stakeholders, dynamics, hot topics, upcoming).

### Open Commitments
- **Title** (domain) — due YYYY-MM-DD (N days remaining)
- **[confidential]** — due YYYY-MM-DD (for confidential=true)
For overdue: flag **OVERDUE**

### Past Meetings
- **YYYY-MM-DD** — Meeting title
  Preview: first 100 chars

### Related Tasks
- Task title (domain) — due YYYY-MM-DD

### Memory Mentions
> Relevant memory excerpt...

## Step 6: Set session context

If single domain identified:
> "Session context: **{Domain}**. `/new` commands will default to this domain."

Summary:
- Meeting: {topic or participants}
- Participants: N resolved, M unresolved
- Open commitments: N (M overdue)
- Past meetings: N on file
- Memory mentions: N

## LLM routing policy

Apply per-node routing as context is loaded. Priority order:

| Condition | Route | Action |
|-----------|-------|--------|
| `metadata.confidential == true` on any node | **Local** (certain) | Redact content; show title + date + 🔒 only |
| Node is a commitment or meeting with no confidential flag | **Cloud** | Show full content |
| Org/person context | **Cloud** | Always safe to show |

### Confidential node handling (applies to commitments, past meetings, and related notes)

**Commitments**: show title + due date + domain only. Replace body with `[confidential]`.
```
- **[confidential]** (EIT Water) — due 2026-03-15 (21 days)
```

**Past meeting notes**: show date + title only. Do not show preview or content.
```
- **2026-02-10** — [confidential meeting]  🔒
```

**Related notes/tasks**: if confidential, show title only, no preview.

### Synthesis rules

Claude may synthesise freely from non-confidential nodes.

For confidential nodes, do NOT include their content in any synthesis or summary. Instead note:
```
🔒 N confidential item(s) loaded but withheld from synthesis.
```

If the user needs to reason about confidential content during prep, direct to Maci Ollama:
```bash
curl http://100.100.142.16:11434/api/generate \
  -d '{"model":"qwen2.5:32b","stream":false,"prompt":"<confidential content>\n\nSummarise key points for a meeting prep."}'
```
Requires Tailscale active. Model: `qwen2.5:32b` on Maci (`http://100.100.142.16:11434`).

## Edge cases

- No participants found: show what's available (org context, commitments)
- Multiple orgs: show all org contexts; group commitments by domain
- Org node not found: skip org context, note it
- No `.config/pkm/paperless_token`: skip Paperless section silently
