# Add save draft option to design editor

Add a "Save Draft" option to the design editor that saves token changes to the database without triggering a staging deployment. This allows iteration without deployment overhead.

## Why

Currently, every save triggers a staging deployment via Railway. This makes rapid experimentation costly in time and resources. A "Save Draft" option allows users to iterate on token values, save their work, and only deploy when ready to test in staging.

## Current State

SimplifiedDesignEditor (SimplifiedDesignEditor.tsx:15-358) has a single "Save Changes" button that triggers the `/admin/simplified-tokens` endpoint (main.py:1241-1294), which:
1. Saves tokens to the database
2. Immediately triggers trigger_staging_deployment() (main.py:1347-1420)

There's no way to save without deploying.

## Desired Behavior

- Add a "Save Draft" button alongside the existing save button
- "Save Draft" saves tokens to database without triggering deployment
- Rename existing button to "Save & Deploy" for clarity
- Both buttons should show appropriate loading states
- Success messages should distinguish between "draft saved" and "saved and deployed"
- Consider making "Save Draft" the primary action and "Save & Deploy" secondary (visual hierarchy)

## Technical Approach

Backend:
- Add a new endpoint `/admin/simplified-tokens/draft` that saves tokens without deployment
- OR add a `deploy` query parameter to existing endpoint (e.g., `?deploy=false`)
- Preserve existing `/admin/simplified-tokens` endpoint behavior for "Save & Deploy"

Frontend:
- Add second button to SimplifiedDesignEditor
- Wire "Save Draft" to draft endpoint
- Update button labels for clarity
- Distinguish success messages
- Consider visual hierarchy (primary vs secondary button styling)

## Principles

### Unsurprising UX

The user interface should be as "guessable" as possible.

Following the [Principle of Least Astonishment](https://en.wikipedia.org/wiki/Principle_of_least_astonishment), users form expectations about how a tool will behave based on conventions, prior experience, and intuition. Dust's interface (including the CLI) should match those expectations wherever possible. If users are observed trying to use the interface in ways we didn't anticipate, the interface should be adjusted to meet their expectations — even if that means supporting many ways of achieving the same result.

Surprising behavior erodes trust and slows people down. Unsurprising behavior lets users stay in flow.

### Fast Feedback Loops

The primary feedback loop — write code, run checks, see results — should be as fast as possible.

Fast feedback is the foundation of productive development, for both humans and agents. When tests, linters, and type checks run in seconds rather than minutes, developers iterate more frequently and catch problems earlier. Agents especially benefit because they operate in tight loops of change-and-verify; slow feedback wastes tokens and context window space on waiting rather than working.

Dust should help projects measure the speed of their feedback loops, identify bottlenecks, and keep them fast as the codebase grows. This includes promoting practices like unit tests over integration tests for speed, incremental compilation, and check parallelisation.

### Prefer small executable tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

### Production deployment approval

Production is frozen by default for agent-driven changes. Production changes require explicit human signoff.

- Agent work should be validated locally or on staging environments first.
- Production deployment requires explicit human approval before proceeding.
- Agents should complete implementation and testing autonomously, then request approval for production deployment.
- This ensures safety while preserving agent autonomy in development environments.

## Task Type

implement

## Blocked By

(none)

## Definition of Done

- "Save Draft" button saves tokens without triggering deployment
- "Save & Deploy" button maintains existing save+deploy behavior
- Both buttons show appropriate loading and success states
- Success messages clearly distinguish between draft and deployed saves
- Backend endpoint or parameter supports both behaviors
- Implementation is complete and can be tested end-to-end
- Changes are committed atomically with this task file deleted
