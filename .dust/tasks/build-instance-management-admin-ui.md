# Build Instance Management Admin UI

Create admin interface for creating, editing, and managing instances. Includes instance list view, creation wizard for basic config (name, slug, cloning), and edit interface for customizing UI copy, design tokens, and prompts. Makes multi-instance system fully self-service via UI.

## Context

Backend supports multiple instances with routing and separate databases. Frontend renders config-driven UI. This task adds the admin interface to make instance creation accessible without direct database or API manipulation.

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

- New route `/admin/instances` shows list of all instances (name, URL, created date, active status)
- "Create New Instance" button opens creation wizard
- Creation wizard collects: instance key (slug), display name, subdirectory, clone from existing (optional)
- On creation, backend provisions new SQLite database and seeds with config (from system defaults or cloned instance)
- Instance edit view allows updating UI copy (page title, placeholders, button labels)
- Instance edit view allows updating design tokens (primary color, other key colors)
- Instance edit view allows updating prompts (system prompts for formatting, steel man, etc.)
- Changes to config via admin UI persist to database
- Admin can toggle instance active/inactive status
- Create "True Confessions" instance via UI as validation
- Access True Confessions at `/confessions/` and verify it's distinct from Hot Takes
- Tests verify instance creation, config updates, and isolation
- Task file is deleted upon completion

## Technical Approach

**New API endpoints:**
- `GET /admin/instances` - list all instances
- `POST /admin/instances` - create new instance
- `PUT /admin/instances/{key}` - update instance metadata
- `GET /admin/instances/{key}/config` - get instance config for editing
- `PUT /admin/instances/{key}/config` - update instance config
- `DELETE /admin/instances/{key}` - soft delete (set is_active=false)

**New frontend components:**
- `app/src/admin/InstanceList.tsx` - list view of all instances
- `app/src/admin/CreateInstanceWizard.tsx` - multi-step creation form
- `app/src/admin/InstanceEditor.tsx` - edit instance config (tabs for UI copy, design tokens, prompts)
- Update `app/src/AdminPanel.tsx` to include instances tab

**Wizard steps:**
1. Basic info (key, display_name, subdirectory)
2. Clone source (system defaults or existing instance)
3. Customize UI copy (form with text inputs)
4. Customize design tokens (color pickers for key colors)
5. Review and create

**Instance provisioning:**
- On creation, backend creates new SQLite file at `/app/data/instances/{instance_key}.db`
- Run Alembic migrations on new database
- Seed InstanceConfig with defaults or cloned values
- Return instance details to frontend

## Out of Scope

- Advanced prompt editing (basic overrides only; full prompt studio is future idea)
- Instance analytics/metrics dashboard
- Preview mode (render sample observation with config)
- Instance templates/marketplace
- Permissions system (assume admin_email auth for all instance management)
- Bulk operations (clone, archive multiple instances)

## Decomposes Idea

- Multi-Instance Deployment Framework

## Task Type

implement

## Blocked By

- Add Instance Configuration Persistence
- Implement Config-Driven Frontend Rendering
- Implement Instance Routing and Multi-Database
