# Persist prompt default model

Store a default model on prompt configs so each prompt can carry its intended baseline model.

## Task Type

implement

## Blocked By

(none)


## Definition of Done

- Prompt persistence supports a model field in defaults, database reads, and prompt update writes.
- Seeded prompt records and fallback prompt loading remain backward compatible for prompts without a saved model.
- Admin prompt saves can update the prompt's default model cleanly.
- Prompt reads returned to the frontend include the model field.
