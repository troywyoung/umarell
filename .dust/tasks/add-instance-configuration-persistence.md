# Add Instance Configuration Persistence

Create database models and API endpoints to store and retrieve instance configuration (prompts, design tokens, UI copy, branding). Migrate the existing "Hot Takes" configuration from in-memory to database storage. This enables configuration to survive restarts and sets foundation for multi-instance support.

## Context

Currently, prompts and design tokens are defined in Python modules (`api/prompts.py`, `api/design_tokens.py`) and modifications via admin API are in-memory only. This task creates the persistence layer without changing routing or adding multi-instance UI.

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

- Database schema includes `Instance`, `InstanceConfig`, `InstancePrompt` models in `api/models.py`
- Migration creates default "hot-takes" instance with current prompts and design tokens
- API endpoint `GET /instance/{instance_key}/config` returns merged configuration
- API endpoints `PUT /admin/instances/{key}/prompts/{prompt_key}` and `PUT /admin/instances/{key}/config` persist to database
- Existing admin panel reads from database instead of in-memory state
- All configuration survives API restart
- Tests verify config persistence and retrieval
- Task file is deleted upon completion

## Technical Approach

**Database Models:**
- `Instance` table: id, key (unique slug), display_name, subdirectory, database_name, is_active, created_at, updated_at
- `InstanceConfig` table: id, instance_id (FK), config_type (enum: branding, design_tokens, ui_copy), config_data (JSON), updated_at
- `InstancePrompt` table: id, instance_id (FK), prompt_key, name, description, system, max_tokens, is_default, updated_at

**API Changes:**
- Add `GET /instance/{instance_key}/config` - returns merged config (defaults + overrides)
- Modify `PUT /admin/prompts/{key}` to save to database for current instance
- Modify `PUT /admin/design-tokens` to save to database for current instance
- Add migration script to seed "hot-takes" instance with current defaults

**Config Loading:**
- Refactor `api/prompts.py` to load from database with fallback to module defaults
- Refactor `api/design_tokens.py` similarly
- Add config merge logic (instance overrides layer on top of system defaults)

## Out of Scope

- Multi-instance routing (still single instance, just persisted)
- Frontend changes (frontend doesn't fetch config yet)
- Admin UI for creating instances (use API directly for now)
- Separate databases per instance (still using single `umarell.db`)

## Decomposes Idea

- Multi-Instance Deployment Framework

## Task Type

implement

## Blocked By

(none)
