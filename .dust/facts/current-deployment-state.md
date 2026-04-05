# Current deployment state

This fact documents the actual deployment infrastructure that exists today and what blocks a safe staging workflow.

## What Exists

### Dockerfiles
- **API Dockerfile** — `/api/Dockerfile` exists, configured for Python/FastAPI with uvicorn, uses Railway's `$PORT` variable
- **App Dockerfile** — `/app/Dockerfile` exists, configured for Node/Vite with multi-stage build

### Documentation
- **Hosting model** — `.dust/facts/hosting-and-environment-model.md` defines Railway-based staging/production split with branch-based deployment
- **Deployment guide** — `DEPLOYMENT.md` provides step-by-step Railway setup instructions
- **Frontend config** — `app/src/config.ts` currently points to `https://umarell-production.up.railway.app`

### Git branches
- `main` exists (development trunk)
- `staging` branch exists and is ready for Railway deployment
- `production` branch **does not exist yet** (create when ready for production deployment)

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

## Blockers for Production Deployment

1. **No Railway account/projects** — Railway hosting account needs to be set up with separate projects for staging and production (see `DEPLOYMENT.md` for setup guide)
2. **No environment variables configured** — Secrets (API keys, JWT secrets, database URLs) need to be set in Railway UI
3. **No database provisioning** — PostgreSQL instances need to be created for each environment
4. **No service configuration** — Railway services need to be configured to point to `/api` and `/app` directories
5. **No domain setup** — Custom domain `umarell.app` needs to be pointed to production Railway service
6. **No migration tooling** — Alembic (or equivalent) needs to be added and configured for schema management

## Current Deployment Process

Staging is ready to be deployed following the workflow in `DEPLOYMENT.md`:

```bash
git checkout staging
git merge main
git push origin staging
```

Once Railway projects are created and configured, this will trigger automatic deployment.

## Next Steps

To complete the staging environment setup:
1. Create Railway account and staging project
2. Follow `DEPLOYMENT.md` to configure Railway services
3. Set environment variables in Railway UI
4. Provision PostgreSQL database
5. Push to `staging` branch to trigger first deployment
6. Verify deployment at staging URL

For production (when ready):
1. Create `production` branch from `staging`
2. Create Railway production project
3. Configure services, secrets, and custom domain
4. Add database migration tooling
5. Test promotion path: `main` → `staging` → `production`
