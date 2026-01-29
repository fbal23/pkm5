---
name: Prep
description: Quick summary brief — extract the gist to help decide if content is worth deeper engagement.
---

# Prep

Quick summary to help the user decide if content is worth deeper engagement.

## Steps

1. **Read the Node**
   - Call `getNodesById` for the focused node
   - Understand what this is and extract the core message

2. **Append Brief**
   Call `updateNode` ONCE using the `content` field with ONLY this section:

   ```
   ---
   ## Brief

   **What:** [One sentence — what is this?]

   **Gist:** [2-3 sentences — the core message or takeaway]

   **Why it matters:** [1-2 sentences — relevance or implications]
   ```

   Use `updates.content` (NOT chunk). Send ONLY the new section. The tool appends automatically.

3. **Return Summary**
   Reply with a one-line confirmation: "Prepped [title] — [gist in <10 words]"

## Rules

- Keep total tool calls ≤ 3
- Call `updateNode` exactly once
- Be concise — this is a quick prep, not deep analysis
