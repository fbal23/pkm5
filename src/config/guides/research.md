---
name: Research
description: Deep research — conduct background web research on a topic and append findings to the node.
---

# Research

Conduct background research on the topic/person/concept and append findings to the node.

## Steps

1. **Read & Identify**
   - Call `getNodesById` for the focused node
   - Identify: what needs researching? (person's background, concept origins, recent developments, etc.)

2. **Web Research**
   - Call `webSearch` with targeted queries (1-2 searches)
   - Focus on: background context, recent news, authoritative sources
   - Extract the most relevant findings

3. **Append Research**
   Call `updateNode` ONCE using the `content` field with ONLY this section:

   ```
   ---
   ## Research Notes

   **Background:** [2-3 sentences of context]

   **Key Findings:**
   - [Finding 1]
   - [Finding 2]
   - [Finding 3]

   **Sources:** [Brief attribution]
   ```

   Use `updates.content` (NOT chunk). Send ONLY the new section. The tool appends automatically.

4. **Return Summary**
   Reply with: "Researched [topic] — [key insight in <15 words]"

## Rules

- Keep total tool calls ≤ 5
- Call `updateNode` exactly once
- Focus on factual background, not opinion
- Cite sources when possible
