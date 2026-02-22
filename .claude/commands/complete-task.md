# /complete-task — Mark a task as complete

Find a task in RA-H and mark it complete. Optionally record a completion note.

## Input

Arguments: `$ARGUMENTS`

- Task title or partial title text
- Or task node ID (e.g. `id:42`)

Examples:
- `/complete-task Review HAC26 proposal`
- `/complete-task id:42`

## Step 1: Resolve the task

If ID given: `rah_get_nodes([<id>])` to confirm it's a task node.

If title given: `rah_search_nodes` with query = title text, dimensions = `["task"]`. Show top matches if ambiguous:

```
Found multiple matches:
1. (ID: 42) Review HAC26 proposal draft — due 2026-02-22 [HAC26]
2. (ID: 38) Review HAC26 budget proposal — due 2026-02-28 [HAC26]

Which one? (enter ID or number, or 'cancel')
```

## Step 2: Update the node

Call `rah_update_node`:
- Add `complete` dimension, remove `pending` dimension
- `metadata`: add `completed_at: <today ISO date>`
- Optionally append completion note to `content`

Dimensions update: `["task", "<domain>", "complete"]` (removes `pending`)

**Note**: RA-H `updateNode` replaces dimensions array. Reconstruct dimensions from existing node: keep all non-status dimensions, replace `pending` with `complete`.

## Step 3: Confirm

```
✓ Task completed (ID: 42): "Review HAC26 proposal draft"
  Completed: 2026-02-22
```

Ask if there are follow-up tasks or commitments to create:
> "Any follow-ups? (`/new task ...` or 'no')"

## Edge cases

- Task already complete: "Task (ID: N) is already marked complete."
- Node not found: "No task found matching '<query>'. Try `/search-vault <query>`."
- Node is not a task type: warn and ask to confirm completing anyway
