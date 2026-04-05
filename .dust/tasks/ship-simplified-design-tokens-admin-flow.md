# Ship simplified design tokens admin flow

Ship a compact design editing flow in admin. Include save feedback, revert to defaults, and automatic staging deployment on save.

## Scope

Create a working vertical slice in the admin interface that replaces broad visual customization with a strict token set of fewer than 15 high-leverage controls. The flow should let an admin edit tokens, save changes, see a clear saved state, revert to defaults, and automatically trigger a staging deployment after a successful save.

## Principles

- [Prefer small executable tasks](../principles/prefer-small-executable-tasks.md)

## Guidance

# Prefer small executable tasks

Prefer tasks that deliver a testable slice of user-visible behavior. Avoid tasks that only add internal plumbing unless that plumbing is the smallest useful unit of work.

## Facts

- [Current deployment state](../facts/current-deployment-state.md)
- [Hosting and environment model](../facts/hosting-and-environment-model.md)
- [Staging review workflow](../facts/staging-review-workflow.md)

## Task Type

implement

## Blocked By

(none)


## Definition of Done

- The admin design UI exposes a strict token set with fewer than 15 controls
- Saving design changes persists the edited values and shows clear saved feedback
- A revert to defaults action restores default token values and can be saved
- A successful save triggers the existing staging deployment path automatically
- The end-to-end flow can be exercised manually from admin edit to staging deploy trigger
