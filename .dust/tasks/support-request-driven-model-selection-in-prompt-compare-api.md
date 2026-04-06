# Support request-driven model selection in prompt compare API

Allow prompt compare endpoints to run against a requested model instead of only the startup-default model.

## Task Type

implement

## Blocked By

- [Show Prompt Model In Admin](show-prompt-model-in-admin.md)


## Definition of Done

- Compare request schemas accept an optional model override for draft preview runs.
- Prompt compare and compare-suite endpoints pass the requested model through to the LLM call layer.
- The pipeline LLM call path can choose provider and model dynamically per request for supported top-choice models.
- Comparison responses continue returning model metadata so the UI can show which model actually ran.
- Existing behavior remains unchanged when no model override is provided.
