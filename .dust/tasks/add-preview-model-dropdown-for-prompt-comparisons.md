# Add preview model dropdown for prompt comparisons

Add a top-choice model selector to prompt preview and comparison actions.

## Task Type

implement

## Blocked By

- [Show Prompt Model In Admin](show-prompt-model-in-admin.md)


## Definition of Done

- The prompt comparison UI includes a dropdown for preview model selection near single-query and suite comparison controls.
- The dropdown is populated with a short curated list of top model choices rather than freeform text entry.
- The selected preview model defaults to the prompt's saved model when present, otherwise the current active model.
- Single-query compare and suite compare requests both include the selected preview model override.
