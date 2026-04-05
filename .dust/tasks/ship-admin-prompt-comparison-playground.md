# Ship admin prompt comparison playground

Ship a prompt playground in admin for side-by-side comparisons. Use the same live-model test input for the saved prompt and a draft prompt.

## Scope

Create a working vertical slice where an admin can load the current prompt, edit a draft, enter a test query, run both prompts against the same live model path, and compare the outputs side by side before deciding whether to save the draft. Comparison runs should be ephemeral and do not need persistence beyond the current session.

## Principles

- [Prefer small executable tasks](../principles/prefer-small-executable-tasks.md)

## Guidance

# Prefer small executable tasks

Prefer tasks that deliver a testable slice of user-visible behavior. Avoid tasks that only add internal plumbing unless that plumbing is the smallest useful unit of work.

## Facts

- [Repository shape](../facts/repository-shape.md)
- [System input output flow](../facts/system-input-output-flow.md)

## Task Type

implement

## Blocked By

(none)


## Definition of Done

- The admin interface shows the currently saved prompt and an editable draft prompt
- An admin can provide a test query and run both prompt versions against the same live model path
- The resulting outputs are displayed side by side in a way that makes comparison practical
- Draft comparison runs are ephemeral and are not stored as evaluation history
- The flow makes it clear which prompt is saved versus unsaved draft content
- The draft prompt can be saved through the admin interface after review
