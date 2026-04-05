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
- `production` branch **ready to create** when first production deployment is needed (see DEPLOYMENT.md for workflow)

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

## Prerequisites for First Production Deployment

Before the first production deployment can happen:

1. **Railway production project** — Create Railway production project (see `DEPLOYMENT.md` for setup guide)
2. **Environment variables** — Configure production secrets in Railway UI (API keys, JWT secret, etc.)
3. **PostgreSQL database** — Provision production PostgreSQL instance
4. **Service configuration** — Configure Railway services to point to `/api` and `/app` directories with `production` branch watch
5. **Custom domain** — Point `umarell.app` to production Railway service
6. **Migration tooling** — Add and configure Alembic for schema management (future task)
7. **Staging validation** — Ensure staging environment is working and validated before production setup

## Current Deployment Process

### Staging Deployment

Staging is ready to be deployed following the workflow in `DEPLOYMENT.md`:

```bash
git checkout staging
git merge main
git push origin staging
```

Once Railway projects are created and configured, this will trigger automatic deployment.

### Production Deployment

Production deployment flow is documented and ready to use. The workflow follows an intentional promotion path:

```
main → staging → production
```

Key aspects:
- **Pre-deployment checklist** ensures staging validation before production release
- **Rollback procedures** are documented with three options (Railway UI, git revert, hard reset)
- **Post-deployment verification** steps ensure deployment succeeded
- **Production branch** will be created on first production deployment

See `DEPLOYMENT.md` for complete production deployment workflow and rollback procedures.

## Next Steps

### For Staging Environment
1. Create Railway account and staging project
2. Follow `DEPLOYMENT.md` to configure Railway services
3. Set environment variables in Railway UI
4. Provision PostgreSQL database
5. Push to `staging` branch to trigger first deployment
6. Verify deployment at staging URL

### For Production Environment
1. Complete staging setup and validate it works
2. Create Railway production project
3. Follow production setup instructions in `DEPLOYMENT.md`
4. Configure services, secrets, and custom domain
5. Use documented deployment workflow to promote from staging to production
6. Follow post-deployment verification checklist
7. Keep rollback procedures accessible for quick recovery if needed
