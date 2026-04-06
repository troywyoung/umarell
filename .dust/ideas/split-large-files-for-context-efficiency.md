# Split large files for context efficiency

Three core files exceed context-window-friendly sizes and should be broken into smaller, focused modules.

## Problem

Three files exceed context-window-friendly sizes:
- `app/src/App.tsx`: 121KB (2551 lines)
- `api/main.py`: 85KB (2404 lines)
- `api/pipeline.py`: 42KB (924 lines)

These large files force agents to consume significant context window space to understand and modify functionality, violating the `context-window-efficiency` and `context-optimised-code` principles.

## Impact

- Agents must load entire files to make small changes
- Harder to understand responsibilities and dependencies
- Increases risk of unintended side effects
- Reduces agent effectiveness when working on related features

## Proposed Solution

1. **App.tsx**: Extract components into separate files (observation form, briefing display, research results, etc.)
2. **main.py**: Split into route modules by feature area (observations, instances, webhooks, admin)
3. **pipeline.py**: Separate research, formatting, and synthesis logic into focused modules

Follow the `intuitive-directory-structure` principle to organize by concern.

## Related Principles

- context-window-efficiency
- context-optimised-code
- intuitive-directory-structure
- small-units
