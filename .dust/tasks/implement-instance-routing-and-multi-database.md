# Implement Instance Routing and Multi-Database

Add subdirectory-based routing so frontend and backend can serve multiple instances from the same deployment. Implement per-instance SQLite databases with middleware that routes requests to the correct database. Enable deploying "Hot Takes" at `/hot-takes` and future instances at other paths.

## Context

Backend persists instance config and frontend renders it dynamically. This task adds the routing layer to support multiple concurrent instances. Uses subdirectory approach (`/hot-takes`, `/confessions`) with separate SQLite files per instance.

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

- Backend middleware extracts instance key from request path (e.g., `/hot-takes/observations` → instance="hot-takes")
- Database session manager switches to instance-specific SQLite file based on instance key
- Instance database files stored at `/app/data/instances/{instance_key}.db`
- Migration moves existing data from `umarell.db` to `hot_takes.db`
- Frontend router detects instance key from URL path and fetches corresponding config
- Frontend routes prefixed with instance key (e.g., `/hot-takes/`, `/confessions/`)
- Create second test instance via API, verify complete isolation (separate DBs, configs, observations)
- Tests verify cross-instance isolation
- Task file is deleted upon completion

## Technical Approach

**Backend changes:**
- Add middleware in `api/main.py` to extract instance key from path
- Modify `api/database.py` to support multiple database files
- Add `get_instance_db_session(instance_key)` function that returns session for specific instance DB
- Store instance key in request state for access in route handlers
- Update all route handlers to use instance-scoped database session

**Frontend changes:**
- Update router to detect instance key from `window.location.pathname`
- Modify `useInstanceConfig` hook to extract instance key and fetch config for it
- Update all navigation to include instance prefix
- Handle root path (`/`) - redirect to default instance or show instance selector

**Database migration:**
- Create `/app/data/instances/` directory
- Copy `umarell.db` to `hot_takes.db`
- Update Instance table to point to new file location
- Add Alembic migration script

**URL structure:**
```
/hot-takes/                  → Hot Takes app
/hot-takes/observations      → observations for Hot Takes
/confessions/                → True Confessions app
/confessions/observations    → observations for Confessions
/admin/instances             → meta-admin (instance management)
/hot-takes/admin             → instance-specific admin (future)
```

## Out of Scope

- Admin UI for creating instances (use direct API/SQL for test instance)
- Subdomain routing (using subdirectory approach per resolved questions)
- Shared vs isolated user accounts (keep current auth model, decide in future task)
- Cross-instance navigation UI

## Decomposes Idea

- Multi-Instance Deployment Framework

## Task Type

implement

## Blocked By

- Add Instance Configuration Persistence
- Implement Config-Driven Frontend Rendering
