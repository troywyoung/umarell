# Build design token live preview system

Create a live preview system that renders Umarell UI components with draft design tokens applied. Admins see visual changes instantly before deploying to staging.

## Why

The current design editor shows token values but no visual representation of how they affect the UI. This forces a slow deploy-to-staging workflow to see changes, making rapid design iteration impractical. A live preview system provides instant visual feedback, dramatically speeding up the design iteration loop.

## Current State

SimplifiedDesignEditor (app/src/admin/SimplifiedDesignEditor.tsx) provides controls for 14 simplified tokens (primary color, backgrounds, font size, etc.) and can save them to the database. However:
- No preview of how token changes affect UI
- Must save and deploy to staging to see visual results
- Token values displayed as text/color swatches only
- No ability to compare current production vs. draft side-by-side

The existing `instance_configs` table stores tokens per-instance (resolved question: per-instance customization is the chosen approach).

## Desired Behavior

**Preview pane:**
- Show actual Umarell components rendered with draft tokens applied
- Display key screens: observation input, thesis display, steel man output, counterpoint view
- Update preview instantly as token values change (debounced for performance)
- Use real production observations for realistic preview content (resolved question: Option 1)

**Comparison mode:**
- Toggle to show production vs. draft side-by-side
- Same content rendered with both token sets
- Visual diff highlighting where tokens differ

**Technical approach:**
- Render preview components in an iframe or shadow DOM to isolate token application
- Pass draft tokens as CSS variables or theme props to preview components
- Load recent production observations to populate preview (anonymized: thesis text only, no user info)
- Fallback to synthetic test data if no recent observations exist

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

### Fast Feedback

Dust should provide fast feedback loops for developers.

Faster feedback enables faster iteration, which compounds over time. Tests, CI checks, and local validation should return results quickly. Slow feedback loops discourage testing and experimentation, leading to less reliable code. Dust should help maintain fast feedback by encouraging fast tests, incremental checking, and parallel execution.

## Task Type

implement

## Blocked By

(none)

## Definition of Done

- Preview pane renders actual Umarell components with draft tokens applied
- Preview updates in real-time as tokens change (debounced)
- Preview content populated from real production observations (thesis text only)
- Fallback to synthetic test data if no observations available
- Side-by-side comparison mode shows production vs. draft
- Preview renders in isolated context (iframe or shadow DOM)
- Implementation is complete and can be tested end-to-end
- Changes are committed atomically with this task file deleted
