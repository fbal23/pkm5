# /post-meeting — Process meeting notes into RA-H nodes

Extract attendees, decisions, action items, and key discussion from raw meeting notes. Create a meeting node with attendee edges. Update person/org cards.

## Input

Arguments: `$ARGUMENTS`

Options:
- No args → prompt for meeting notes (paste or describe)
- Path to a notes file
- `latest` → check for most recently modified clipping node in RA-H

## Step 1: Get meeting content

Prompt: "Paste meeting notes (or type 'done' on a new line when finished):"

Accept: raw notes, bullet points, email thread, or transcript.

## Step 2: Extract structured data

From the raw content, identify:

1. **Date**: explicit date or infer from context (default today)
2. **Title**: derive from topic/agenda (e.g. "EIT Water Board Call 2026-02-22")
3. **Domain**: infer from org/participants
4. **Attendees**: list of participant names
5. **Decisions**: explicit decisions made
6. **Action items**: tasks / follow-ups (`#action` tagged inline — NOT promoted to tasks yet)
7. **Key discussion points**: main topics covered
8. **Governance observations**: patterns, dynamics, power moves worth noting

## Step 3: Resolve attendees

For each attendee name, `rah_search_nodes(query="<name>", dimensions=["person"], limit=2)`.

Report:
- Resolved (ID: N): Name — Role at Org
- Unresolved: Name — will create stub

Create person stubs for unresolved attendees:
```
rah_add_node(title="<Name>", dimensions=["person", "<domain>"],
  metadata={ cited: 1, last: "<meeting date>", org: "<inferred org>" })
```

## Step 4: Create meeting node

```
rah_add_node:
  title: "<Meeting Title>"
  dimensions: ["meeting", "<domain>"]
  content: |
    # <Meeting Title>
    Date: YYYY-MM-DD
    Attendees: Name1, Name2, ...

    ## Decisions
    - Decision 1
    - Decision 2

    ## Discussion
    - Key point 1

    ## Actions #action
    - [ ] Action item 1 (owner if known)
    - [ ] Action item 2

    ## Observations
    - Governance / dynamic notes
  metadata: { date: "YYYY-MM-DD", confidential: false }
```

**Important**: Action items stay inline with `#action` tag. Do NOT create separate task nodes now. Run `/parse-clippings` or `/consolidate` later to promote them to tasks.

## Step 5: Create attendee edges

For each resolved person node:
```
rah_create_edge(meetingId, personId, "attended by <Name>")
```

## Step 6: Update person/org nodes

For each resolved person:
```
rah_update_node(id=personId, updates={
  metadata: {
    ...existing_metadata,
    last: "<meeting date>",
    cited: existing_cited + 1
  }
})
```

For the org (if one org involved):
```
rah_update_node(id=orgId, updates={
  metadata: { last: "<meeting date>" }
})
```

## Step 7: Suggest memory updates

Review decisions and observations. If any insight warrants memory:
> "Worth adding to memory: '<insight>'. Save as insight node? (yes/no)"

If yes: `rah_add_node(title="<insight>", dimensions=["insight", "<domain>"], description="<insight>")`

## Step 8: Summary

```
✓ Meeting created (ID: N): "<title>"
  Date: YYYY-MM-DD | Domain: <domain>
  Attendees: N resolved, M created as stubs
  Actions: N inline (#action tagged)
  Person cards updated: N

Next: run /consolidate to promote #action items to task nodes.
```

## LLM routing

If `metadata.confidential == true` is flagged during extraction:
- Set `metadata.confidential: true` on the meeting node
- Do not route content to cloud for synthesis — process locally

## Edge cases

- No identifiable attendees: create meeting node without edges
- No decisions / actions: note "No decisions recorded" in content
- Duplicate meeting: if very similar title + date exists, warn and ask before creating
