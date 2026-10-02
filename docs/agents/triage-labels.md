# Triage Labels

The skills speak in terms of **category** roles and **state** roles. This file maps those roles to the strings used in this repo's issue tracker.

## Category roles

Exactly one per ticket.

| Label in mattpocock/skills | Label in our tracker | Meaning |
| -------------------------- | -------------------- | ------- |
| `bug` | `bug` | Something is broken |
| `enhancement` | `enhancement` | New feature or improvement |

## State roles

Exactly one per ticket.

| Label in mattpocock/skills | Label in our tracker | Meaning |
| -------------------------- | -------------------- | ------- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an AFK agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

## Local markdown tickets

Near the top of each file under `.scratch/`:

```markdown
Category: enhancement
Status: ready-for-agent
```

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding string from the tables above.
