# Show prompt model in admin

Show each prompt's saved model in the admin editor and prompt list.

## Task Type

implement

## Blocked By

(none)


## Definition of Done

- Prompt admin fetches and displays a prompt model field alongside name, description, system, and max token settings.
- The editor shows the saved/default model clearly when a prompt is selected.
- The UI handles prompts without an explicit saved model by showing the current active fallback model.
- Prompt save flows preserve the model field without regressing existing prompt editing behavior.
