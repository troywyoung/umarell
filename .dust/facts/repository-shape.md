# Repository shape

This fact records the current repository layout at a high level.

- The repository includes a `.dust/` directory for planning artifacts.
- Planning artifacts include facts, principles, and tasks.
- One local principle exists: `prefer-small-executable-tasks.md`.
- The project has a Python/FastAPI backend in `/api` and React/Vite frontend in `/app`.
- Local development uses Docker Compose with both services.
- Deployment is managed through Railway with separate staging and production environments.
