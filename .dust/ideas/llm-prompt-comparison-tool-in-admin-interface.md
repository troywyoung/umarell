# LLM prompt comparison tool in admin interface

Add an admin prompt playground that compares prompt changes against a test query before saving. The goal is to let you edit the meta prompt, run the old and new versions side by side, and inspect how the user experience would change before committing the prompt update.

## Why

Prompt changes are high leverage but hard to judge from the raw text alone. A comparison tool would make prompt iteration safer and faster by showing the behavioral impact immediately.

## Desired behavior

- Edit the current meta prompt in the admin interface.
- Enter a test query or use a saved example.
- Run both the current prompt and the edited prompt against the same input.
- Show outputs side by side for comparison.
- Make it clear which prompt is saved and which is only a draft.

## Open Questions

### Should comparison runs call live models or use a cheaper preview mode?

#### Option: Live model calls

Most realistic, but slower and more expensive.

#### Option: Preview mode with constrained settings

Faster and cheaper, but may differ from real production behavior.

### Should comparisons be ephemeral or saved as evaluation history?

#### Option: Ephemeral comparisons

Simpler and lower storage overhead.

#### Option: Saved comparisons

Creates an audit trail and supports iterative prompt tuning over time.
