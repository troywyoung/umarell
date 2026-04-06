# Add staging verification link after save

Show a link to the staging environment after saving design tokens. Include instructions to verify the changes, providing low-tech deployment feedback without API polling.

## Why

After saving design tokens, users need to verify that changes look correct in the staging environment. Currently, the system triggers a deployment but provides no guidance on how to check the results. A simple link with instructions provides clear next steps without complex deployment status tracking.

## Current State

SimplifiedDesignEditor (SimplifiedDesignEditor.tsx:15-358) shows a success banner after saving, which mentions that a staging deployment was triggered. However, it doesn't provide a link to the staging environment or instructions on how to verify the changes.

The save endpoint (main.py:1241-1294) triggers a staging deployment via trigger_staging_deployment() (main.py:1347-1420), but the frontend doesn't present the staging URL or verification workflow to the user.

## Desired Behavior

- After successful save, show a message with a link to the staging environment
- Include instruction like "Changes saved and deployed to staging. Verify changes at [staging URL]"
- Link should open in a new tab
- Message should be part of the success feedback flow
- Should replace or augment the current "Changes saved successfully!" banner

## Technical Approach

- Modify the success banner in SimplifiedDesignEditor to include staging URL
- Get staging URL from environment config or hardcode if it's stable
- Format as a clickable link with target="_blank"
- Consider adding note about deployment timing ("may take 1-2 minutes to reflect")

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

- Success message includes a clickable link to the staging environment
- Link opens in a new tab when clicked
- Message provides clear instruction to verify changes in staging
- Implementation is complete and can be tested end-to-end
- Changes are committed atomically with this task file deleted
