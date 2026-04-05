# Decompose Idea: Multi-Instance Deployment Framework

Create one or more well-defined tasks from this idea. Prefer smaller, narrowly scoped tasks that each deliver a thin but complete vertical slice of working software -- a path through the system that can be tested end-to-end -- rather than component-oriented tasks (like "add schema" or "build endpoint") that only work once all tasks are done. Split the idea into multiple tasks if it covers more than one logical change. Run `dust principles` to identify relevant principles (both core and local), then inline the FULL content of ALL selected principles in a Guidance section in each new task file (after Principles but before Definition of Done). This ensures implementing agents read the guidance without extra tool calls. Also run `dust facts` for design decisions that should inform the task. See [Multi-Instance Deployment Framework](../ideas/multi-instance-deployment-framework.md).

## Resolved Questions

### What is the URL structure for instances?

**Decision:** Option: Subdirectory-based (e.g., `/hot-takes`, `/confessions`)

### How should databases be isolated?

**Decision:** Option: Separate SQLite file per instance

### What configuration can instances override vs inherit?

**Decision:** Option: Tiered override (basic vs advanced customization)

### Should instances share user accounts or be isolated?

**Decision:** Option: Shared user accounts (one login across all instances)

### How does the admin interface handle instance selection?

**Decision:** Option: Global admin panel with instance dropdown

### What happens to existing "Hot Takes" during migration?

**Decision:** Option: Freeze current, launch fresh

### Should instance creation be self-service or gated?

**Decision:** Option: Fully self-service (future B2B model)


## Decomposes Idea

- [Multi-Instance Deployment Framework](../ideas/multi-instance-deployment-framework.md)


## Task Type

decompose

## Blocked By

(none)


## Definition of Done

- One or more new tasks are created in .dust/tasks/
- Task's Principles section links to relevant principles from .dust/principles/
- The original idea (.dust/ideas/multi-instance-deployment-framework.md) is deleted or updated to reflect remaining scope
