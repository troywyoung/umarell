# Simplify admin interface architecture

Replace the existing 1,210-line AdminPanel.tsx with a cleaner admin interface. Structure it around two main sections using lazy-loaded routing to avoid bundle bloat.

## Why

The current admin interface (AdminPanel.tsx, 1,210 lines) is complex and doesn't function properly. The resolved questions indicate:
- Admin should be a lazy-loaded route (resolved question: Option 3)
- Staging deployment triggered manually via Railway dashboard (resolved question: Option 1)
- Design tokens are per-instance (resolved question: Option 2)

Rebuilding from scratch with a clearer structure will create a better foundation for the preview and comparison features being added in parallel tasks.

## Current State

**Current admin structure:**
- AdminPanel.tsx (1,210 lines) with 4 tab sections: Instances, LLM Prompts, Design Tokens, Podcast Ingest
- Backend has 28 admin routes in api/main.py
- Authentication via JWT token + `admin_email` role check
- Design tokens in SimplifiedDesignEditor.tsx (may be salvageable)

**Issues:**
- Overly complex tab structure (4 sections when only 2 are needed)
- Not functioning properly (per idea description)
- Bundled with main app, increasing load time
- Difficult to navigate and understand

## Desired Behavior

**New architecture:**
- New component: `app/src/admin/AdminV2.tsx` (replaces AdminPanel.tsx)
- Two main sections (not four):
  1. **Design System** - token controls + live preview
  2. **Prompts & LLM** - prompt editing + comparison testing
- Lazy-loaded admin route at `/admin` to avoid bundle bloat (resolved question: Option 3)
- Simpler navigation: section tabs or side navigation
- Consistent workflow across both sections: edit draft → save draft → manual deploy to staging via Railway dashboard

**Design principles:**
- Simple and intuitive controls — fewer clicks, clearer visual hierarchy
- Preview-first workflow — see changes before committing
- Clear separation of concerns between design and prompts

**Lazy loading:**
- Admin code-split and lazy-loaded only when `/admin` route accessed
- Main app bundle size unaffected by admin interface code
- Fast initial load for regular users

**Deployment workflow:**
- Both sections save drafts to database (no automatic deployment)
- Admin manually deploys to staging via Railway dashboard UI
- Link to staging URL provided after save for manual verification
- Optional: Add "Open Staging" button that links to https://umarell-staging.up.railway.app

## Principles

### Unsurprising UX

The user interface should be as "guessable" as possible.

Following the [Principle of Least Astonishment](https://en.wikipedia.org/wiki/Principle_of_least_astonishment), users form expectations about how a tool will behave based on conventions, prior experience, and intuition. Dust's interface (including the CLI) should match those expectations wherever possible. If users are observed trying to use the interface in ways we didn't anticipate, the interface should be adjusted to meet their expectations — even if that means supporting many ways of achieving the same result.

Surprising behavior erodes trust and slows people down. Unsurprising behavior lets users stay in flow.

### Context window efficiency

Dust should be designed with short attention spans in mind.

Large, monolithic files and deeply nested structures make it hard for both humans and agents to understand code quickly. Breaking code into smaller, focused units means agents can understand and modify specific parts without loading the entire system into their context window. This applies to configuration, documentation, and code alike.

Prefer many small files over few large ones. Prefer shallow, explicit structure over deep nesting. This reduces the cognitive load and context window overhead for understanding and modifying the system.

### Prefer small executable tasks

This principle keeps agent work concrete and safe.

- Prefer tasks that can be completed and verified in one session.
- Write tasks in terms of visible outcomes, not vague investigation.
- Capture current reality as facts before changing system behavior.
- Use ideas for later possibilities and tasks for immediate execution.

### Intuitive directory structure

Code should be organized around related concerns in clearly named directories.

A well-structured directory hierarchy acts as documentation. When files are grouped by feature, domain, or architectural layer, developers can navigate the codebase by intuition rather than by grep. Clear naming and consistent organization reduce the time spent searching for code and increase the time spent understanding and improving it.

Avoid vague or overly generic directory names like `utils`, `helpers`, or `misc`. Prefer names that describe the domain or purpose: `auth`, `pipeline`, `admin`, `design-tokens`.

### Progressive disclosure

Dust should reveal details progressively as a way of achieving context window efficiency.

Users — especially AI agents with limited context windows — should encounter information in layers. Start with high-level summaries and let them drill down into details only when needed. This applies to commands (overview first, details on request), documentation (structured facts with progressive detail), and code structure (clear public interfaces hiding implementation details).

When designing commands or interfaces, ask: "Can someone get oriented without seeing everything at once?" Progressive disclosure keeps cognitive load low and makes Dust easier to explore.

## Task Type

implement

## Blocked By

(none)

## Definition of Done

- New AdminV2.tsx component created with two-section structure
- Lazy-loaded route at `/admin` configured (no bundle bloat in main app)
- Design System section displays token controls (can reuse SimplifiedDesignEditor logic)
- Prompts & LLM section displays prompt list and editor UI
- Navigation between sections is clear and intuitive
- Both sections have "Save Draft" functionality
- Link to staging environment provided after save
- Old AdminPanel.tsx deprecated or removed
- Admin route only loads admin code when accessed
- Implementation is complete and can be tested end-to-end
- Changes are committed atomically with this task file deleted
