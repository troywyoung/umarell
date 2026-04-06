# Decompose Idea: Rebuild admin interface with previews

Create one or more well-defined tasks from this idea. Prefer smaller, narrowly scoped tasks that each deliver a thin but complete vertical slice of working software -- a path through the system that can be tested end-to-end -- rather than component-oriented tasks (like "add schema" or "build endpoint") that only work once all tasks are done. Split the idea into multiple tasks if it covers more than one logical change. Run `dust principles` to identify relevant principles (both core and local), then inline the FULL content of ALL selected principles in a Guidance section in each new task file (after Principles but before Definition of Done). This ensures implementing agents read the guidance without extra tool calls. Also run `dust facts` for design decisions that should inform the task. See [Rebuild admin interface with previews](../ideas/rebuild-admin-interface-with-previews.md).

## Resolved Questions

### How should preview content be populated?

**Decision:** Option 1: Use real production observations

### Should design token changes apply globally or per-instance?

**Decision:** Option 2: Per-instance customization

### How should prompt changes be versioned?

**Decision:** Option 3: Git-backed prompt storage (Recommended)

### Should the admin interface be a separate app or embedded in the main app?

**Decision:** Option 3: Lazy-loaded admin route (Recommended)

### How should staging deployment be triggered?

**Decision:** Option 1: Manual deployment via Railway dashboard

### How should prompt output quality be measured in comparisons?

**Decision:** Option 1: Human evaluation only


## Decomposes Idea

- [Rebuild admin interface with previews](../ideas/rebuild-admin-interface-with-previews.md)


## Task Type

decompose

## Blocked By

(none)


## Definition of Done

- One or more new tasks are created in .dust/tasks/
- Task's Principles section links to relevant principles from .dust/principles/
- The original idea (.dust/ideas/rebuild-admin-interface-with-previews.md) is deleted or updated to reflect remaining scope
