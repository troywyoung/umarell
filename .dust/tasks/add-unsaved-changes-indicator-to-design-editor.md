# Add unsaved changes indicator to design editor

Add a persistent visual indicator in the simplified design editor. This indicator shows when token values differ from the saved state in the database.

## Why

Users need clear feedback about whether their changes are saved. A persistent indicator separate from the save button provides continuous visibility of save state, helping users avoid accidentally losing work or being unsure whether changes were saved.

## Current State

The SimplifiedDesignEditor (SimplifiedDesignEditor.tsx:15-358) currently provides save state feedback only through the button text changing to "Saving..." and a success banner. There is no persistent indicator showing whether the current token values differ from what's saved in the database.

## Desired Behavior

- Add a persistent "Unsaved changes" indicator (badge or status text) visible when any token value differs from the saved state
- Indicator should appear as soon as a token value is modified
- Indicator should disappear when save completes successfully
- Indicator should be visually distinct from the save button (separate UI element)
- Should not add significant visual noise to the interface

## Technical Approach

- Track original token values when the editor opens
- Compare current form values against original values on each change
- Display indicator when values differ
- Update original values when save succeeds
- Consider using a subtle badge or status text near the save button

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

## Task Type

implement

## Blocked By

(none)

## Definition of Done

- Unsaved changes indicator appears when token values are modified
- Indicator disappears when save completes successfully
- Indicator is visually distinct and easy to understand
- Implementation is complete and can be tested end-to-end
- Changes are committed atomically with this task file deleted
