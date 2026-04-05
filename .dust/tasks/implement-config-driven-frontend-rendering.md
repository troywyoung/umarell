# Implement Config-Driven Frontend Rendering

Make the frontend fetch instance configuration on load and use it to render UI copy, design tokens, and branding dynamically. Replace all hardcoded strings and styling with values from config API. This enables changing the look and feel without code changes.

## Context

Backend now persists instance configuration (from previous task). This task makes the frontend consume that configuration. Still single instance ("hot-takes"), but all customizable elements are now driven by API rather than hardcoded.

## Principles

### Small Units

Ideas, principles, facts, and tasks should each be as discrete and fine-grained as possible.

Small, focused documents enable precise relationships between them. A task can link to exactly the principles it serves. A fact can describe one specific aspect of the system. This granularity reduces ambiguity.

Tasks especially benefit from being small. A narrowly scoped task gives agents or humans the best chance of delivering exactly what was intended, in a single atomic commit.

### Prefer Small Executable Tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

### Atomic Commits

Each commit should tell a complete story, bundling implementation changes with their corresponding documentation updates.

When a task is completed, the commit deletes the task file, updates relevant facts to reflect the new reality, and removes any ideas that have been realized. This discipline ensures that any point in the commit history represents a coherent, self-documenting state of the project.

Clean commit history is essential because archaeology depends on it. Future humans and AI agents will traverse history to understand why decisions were made and how the system evolved.

## Definition of Done

- Frontend fetches config via `GET /instance/hot-takes/config` on app initialization
- Instance config stored in React context accessible throughout app
- Page title (`app/index.html`) rendered from config
- Placeholder prompts in `App.tsx` loaded from config instead of hardcoded array
- Button labels, section headers, empty states read from config
- Design tokens (colors, spacing) applied via CSS custom properties or inline styles
- App looks and behaves identically to before (validates config matches hardcoded values)
- Tests verify config fetch and rendering
- Task file is deleted upon completion

## Technical Approach

**New files:**
- `app/src/contexts/InstanceContext.tsx` - React context for instance config
- `app/src/hooks/useInstanceConfig.ts` - Hook to fetch and provide config

**Modified files:**
- `app/index.html` - Make title dynamic (inject via script or use document.title in React)
- `app/src/App.tsx` - Replace hardcoded placeholders array with `config.ui_copy.placeholder_prompts`
- `app/src/App.tsx` - Replace button text, headers with config values
- Apply design tokens from config to CSS custom properties on mount

**Config structure expected:**
```typescript
interface InstanceConfig {
  instance: {
    key: string;
    display_name: string;
    subdirectory: string;
  };
  ui_copy: {
    page_title: string;
    placeholder_prompts: string[];
    cta_button: string;
    section_header: string;
    empty_state: string;
  };
  design_tokens: {
    colors: { primary: string; background: string; /* ... */ };
    typography: { /* ... */ };
  };
  branding: {
    tagline: string;
    description: string;
  };
}
```

## Out of Scope

- Multi-instance routing (still assumes single "hot-takes" instance)
- Extracting instance key from URL (hardcoded to "hot-takes" for now)
- Admin UI changes (admin panel unchanged)

## Decomposes Idea

- Multi-Instance Deployment Framework

## Task Type

implement

## Blocked By

- Add Instance Configuration Persistence
