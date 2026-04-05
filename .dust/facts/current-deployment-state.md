# Current deployment state

This fact documents the actual deployment infrastructure that exists today and what blocks a safe staging workflow.

## What Exists

### Dockerfiles
- **API Dockerfile** — `/api/Dockerfile` exists, configured for Python/FastAPI with uvicorn
- **App Dockerfile** — `/app/Dockerfile` exists, configured for Node/Vite with multi-stage build

### Documentation
- **Hosting model** — `.dust/facts/hosting-and-environment-model.md` defines Railway-based staging/production split with branch-based deployment
- **Frontend config** — `app/src/config.ts` currently points to `https://umarell-production.up.railway.app`

### Git branches
- Only `main` exists
- `staging` and `production` branches **do not exist yet**

## What Does NOT Exist

### Railway projects
- No Railway projects have been created
- No staging environment is deployed
- No production environment is deployed

### Deployment automation
- No Railway configuration files (`railway.toml` or similar)
- No deployment scripts
- No GitHub Actions or CI/CD workflows
- No automated migration runner

### Branch structure
- `staging` branch does not exist (required for staging deployment)
- `production` branch does not exist (required for production deployment)

## Blockers for Staging Workflow

1. **No Railway account/projects** — Railway hosting account needs to be set up with separate projects for staging and production
2. **Missing branches** — `staging` and `production` promotion branches must be created from `main`
3. **No environment variables configured** — Secrets (API keys, JWT secrets, database URLs) need to be set in Railway UI
4. **No database provisioning** — PostgreSQL instances need to be created for each environment
5. **No service configuration** — Railway services need to be configured to point to `/api` and `/app` directories
6. **No domain setup** — Custom domain `umarell.app` needs to be pointed to production Railway service
7. **No migration tooling** — Alembic (or equivalent) needs to be added and configured for schema management

## Current Manual Deployment Process

**None.** There is no deployment process today. The app has not been deployed to any environment.

## Next Steps

To implement the documented hosting model:
1. Create Railway account and projects (staging and production)
2. Create `staging` and `production` branches from `main`
3. Configure Railway services to watch these branches
4. Provision PostgreSQL databases in each environment
5. Set environment variables in Railway UI
6. Configure custom domain for production
7. Add database migration tooling
8. Test promotion path: `main` → `staging` → `production`
