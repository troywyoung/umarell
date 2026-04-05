# Admin interface refinement

Simplify the design tab so large visual changes can be made through a small set of controls. The goal is to make the overall look and feel editable through roughly 15 high-leverage variables, with clearer save feedback, a revert-to-default action, and easy staging deployment after changes.

## Why

The current design controls feel more complex than they need to be. A smaller, more opinionated configuration surface would make the admin interface easier to use and reduce the risk of inconsistent styling.

## Desired behavior

- Reduce visual customization to a compact set of high-leverage variables.
- Show a clear saved state, including a save button or equivalent saved feedback.
- Add a revert-to-default action.
- Make it straightforward to push design changes to Railway staging for review.

## Open Questions

### Should staging deploy happen automatically after every saved design change?

#### Option: Automatic deploy on save

Fastest feedback, but may create noisy deploys while iterating.

#### Option: Separate deploy action

Gives more control and avoids unnecessary staging churn.

### Which variables belong in the under-15 set?

#### Option: Strict token set

Expose only core brand tokens like primary color, accent, background, typography scale, spacing, and radius.

#### Option: Token set plus a few semantic presets

Keep the variable count low while allowing broader look-and-feel shifts.
