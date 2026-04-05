# System input output flow

This fact maps the current user, frontend, API, and model flow in schematic form.

## Current system flow

```text
User
  ↓
Frontend app (React + Vite in `app/`)
  - renders the main experience
  - collects thesis or response input
  - can attach auth token from localStorage
  ↓ HTTP
API (`api/main.py` FastAPI)
  - authenticates optional user session
  - creates and stores observations
  - returns observation records to the frontend
  ↓ background async task
Pipeline (`_run_pipeline` in `api/main.py`)
  - formats the raw input into a thesis
  - generates a steel man
  - generates metadata
  - stores results and marks status complete or error
  ↓ LLM + retrieval services
Model provider (`api/pipeline.py`)
  - Gemini by default or Anthropic
  - optional Google Search grounding for sources
  - optional Tavily retrieval for URL and search context
  ↓
Database (SQLite via SQLAlchemy)
  - users
  - observations
  - takes
  ↓ HTTP
Frontend polling and follow-up actions
  - fetch observations list
  - poll individual observation status
  - request stress test
  - request counterpoint
  - request PVA take
  ↓
User sees structured output
  - thesis
  - steel man summary
  - metadata and sources
  - optional counterpoint, stress test, and PVA take
```

## Main runtime surfaces

- `app/src/App.tsx` contains the main frontend experience.
- `app/src/hooks/useObservations.ts` handles observation fetch, submit, poll, edit, and delete flows.
- `api/main.py` exposes auth and observation endpoints and launches the async pipeline.
- `api/pipeline.py` handles formatting, model calls, source retrieval, and output shaping.
- `docker-compose.yml` runs the frontend on port `5174` and API on port `8100`.

## Interaction paths

### Core observation flow

1. A user enters a text or image-backed input in the frontend.
2. The frontend posts to `POST /observations`.
3. The API creates an observation row and starts async processing.
4. The pipeline formats the input into a thesis.
5. The pipeline generates a steel man and metadata.
6. The frontend polls for the completed observation.
7. The user sees the completed output.

### Follow-up analysis flow

1. A user selects an existing observation.
2. The frontend requests a follow-up analysis such as stress test, counterpoint, or PVA take.
3. The API calls the corresponding generation path.
4. The result is stored back onto the observation.
5. The frontend updates the visible result.

### Auth flow

1. A user signs in with Google or anonymous auth.
2. The API issues a JWT.
3. The frontend stores the token in localStorage.
4. Later requests include the bearer token when available.

## Current constraints visible from the code

- The frontend currently appears to be a single main app rather than multiple separated apps.
- The app README is still the default Vite template and does not explain the product flow yet.
- Docker Compose is configured for local development, not yet for staging or production deployment.
- SQLite is the current database in the default local setup.

