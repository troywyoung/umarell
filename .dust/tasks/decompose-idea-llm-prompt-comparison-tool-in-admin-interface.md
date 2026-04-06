# Decompose Idea: LLM Prompt Comparison Tool in Admin Interface

Create one or more well-defined tasks from this idea. Prefer smaller, narrowly scoped tasks that each deliver a thin but complete vertical slice of working software -- a path through the system that can be tested end-to-end -- rather than component-oriented tasks (like "add schema" or "build endpoint") that only work once all tasks are done. Split the idea into multiple tasks if it covers more than one logical change. Run `dust principles` to identify relevant principles (both core and local), then inline the FULL content of ALL selected principles in a Guidance section in each new task file (after Principles but before Definition of Done). This ensures implementing agents read the guidance without extra tool calls. Also run `dust facts` for design decisions that should inform the task. See [LLM Prompt Comparison Tool in Admin Interface](../ideas/llm-prompt-comparison-tool-in-admin-interface.md).

## Resolved Questions

### Should test queries be saved and reusable?

**Decision:** Option: Keep ephemeral

### Should comparison results be persisted?

**Decision:** Option: Keep ephemeral

### Should batch comparison be supported?

**Decision:** Option: Saved test suites

### Should the comparison show performance metrics?

**Decision:** Option: Output only

### Should there be a diff view in addition to side-by-side?

**Decision:** Option: Side-by-side only

### How should the tool handle slow or failed LLM calls?

**Decision:** Option: Timeout and error handling

### Should the comparison tool work for prompts that require additional context?

**Decision:** Option: Test query only


## Decomposes Idea

- [LLM Prompt Comparison Tool in Admin Interface](../ideas/llm-prompt-comparison-tool-in-admin-interface.md)


## Task Type

decompose

## Blocked By

(none)


## Definition of Done

- One or more new tasks are created in .dust/tasks/
- Task's Principles section links to relevant principles from .dust/principles/
- The original idea (.dust/ideas/llm-prompt-comparison-tool-in-admin-interface.md) is deleted or updated to reflect remaining scope
