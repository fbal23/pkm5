# /quick — Ultra-fast task capture

Parse minimal natural language input and immediately create a task node in RA-H. No questions, no confirmation — just capture.

## Input

Arguments: `$ARGUMENTS`

Required: task description text.
Optional inline modifiers:
- `domain:<name>` → domain dimension (e.g. `domain:BIO-RED`)
- `due:<date>` → due date (or natural language: "tomorrow", "friday", "eow", "eom", "next week")
- `project:<name>` → associate with a project node

Example: `/quick Review HAC26 proposal draft domain:HAC26 due:friday`

## Step 1: Parse input

Extract:
1. **Title**: everything except modifiers, trimmed
2. **Domain**: from `domain:X` modifier or infer from context keywords
   - Keywords → domain mapping (examples): HAC26, BIO-RED, EIT Water, etc.
   - If truly ambiguous and no domain modifier: default to `admin`
3. **Due date**: parse natural language to ISO date (YYYY-MM-DD)
   - "tomorrow" → today + 1
   - "friday" / "fri" → next Friday
   - "eow" → this Friday
   - "eom" → last day of current month
   - "next week" → next Monday
   - Explicit dates (Feb 28, 2026-02-28, 28/2) → parse directly
4. **Project**: from `project:X` modifier

## Step 2: Search for existing node (dedup)

Run `rah_search_nodes` with the title text, dimensions `["task"]`. If a very close match exists (same title), warn:
> "Similar task found: '<existing title>'. Created anyway (ID: N)."

## Step 3: Create node

Call `rah_add_node`:
- `title`: parsed title
- `dimensions`: `["task", "<domain>", "pending"]`
- `description`: "<title> — captured via /quick"
- `metadata`: `{ "due": "<YYYY-MM-DD>", "project": "<project name>" }` (omit null fields)

## Step 4: Confirm

One-line output:
```
✓ Task created (ID: N): "<title>" [<domain>] due <date or "no date">
```

If a project name was given but no matching project node found, note:
```
  Note: project "<name>" not found in graph — stored as metadata string only.
```

## Edge cases

- No title: prompt "What's the task?"
- Unrecognised domain: use as-is (dimensions are freeform strings in RA-H)
- Date parsing fails: create without due date, note "Could not parse date '<raw>'"
