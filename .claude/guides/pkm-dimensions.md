---
name: pkm-dimensions
description: All dimensions used in the personal knowledge graph — domains, entity types, and status labels.
---

# PKM Dimensions Reference

## Domain Dimensions

These represent organizational and life domains. Every node should carry at least one domain dimension.

| Dimension | Description |
|-----------|-------------|
| `admin` | Administrative work, tools, infrastructure, personal setup |
| `EIT Water` | EIT Water project and consortium activities |
| `InnoStars` | InnoStars programme activities |
| `HAC26` | HAC26 project |
| `BIO-RED` | BIO-RED research project |
| `KillerCatch` | KillerCatch project |
| `MyBoards` | MyBoards product |
| `ClaimMore` | ClaimMore project |
| `InnoMap` | InnoMap project |
| `family` | Personal family matters |
| `health` | Health and wellbeing |
| `hobby` | Hobbies and personal interests |
| `AI_development` | AI tools, Claude, LLM workflows, PKM infrastructure |
| `development` | Software development, code, infrastructure |

## Entity Type Dimensions

These classify what kind of thing a node is. Every node should carry exactly one entity-type dimension.

| Dimension | Description |
|-----------|-------------|
| `task` | A discrete piece of work with a potential due date |
| `project` | A multi-task effort with an outcome |
| `meeting` | A recorded meeting with attendees and discussion |
| `commitment` | A promise made to or by someone, with a due date |
| `person` | A person entity card |
| `org` | An organisation entity card |
| `clipping` | Captured external content (email, article, document) |
| `idea` | An observation, hypothesis, or insight |

## Status Dimensions

Used to track lifecycle state. Applied alongside domain + type dimensions.

| Dimension | Description |
|-----------|-------------|
| `pending` | Not yet started |
| `active` | Currently in progress |
| `complete` | Done |
| `archived` | Historical, no longer active |

## Memory / System Dimensions

| Dimension | Description |
|-----------|-------------|
| `insight` | A proven, reusable lesson (replaces MEMORY.md entries) |
| `proposal` | A card-update or action proposal awaiting review |
| `memory-log` | Timestamped memory log entry |

## Migration Note

These dimensions were migrated from the Obsidian PKM_2026 vault (`config/domains.json` + frontmatter `type` field) on 2026-02-22.

## Dimension Combinations

Standard combinations when adding a node:

```
Task:       ["task", "<domain>"]
Project:    ["project", "<domain>"]
Meeting:    ["meeting", "<domain>"]
Commitment: ["commitment", "<domain>"]
Person:     ["person", "<domain>"]
Org:        ["org", "<domain>"]
Clipping:   ["clipping", "<domain>"]
Idea:       ["idea", "<domain>"]
Insight:    ["insight", "<domain>"]
```
