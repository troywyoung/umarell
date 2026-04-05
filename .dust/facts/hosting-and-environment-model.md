# Hosting and environment model

This fact defines how Umarell's staging and production environments work.

## Hosting Platform

**Railway** — chosen for its straightforward deployment of multi-service apps, built-in database provisioning, PR environments, and branch-based deployment workflows.

## Environment Boundaries

### Staging
- **Purpose**: Pre-production validation. Used to test changes before promoting to production.
- **URL**: `https://umarell-staging.up.railway.app`
- **Database**: Dedicated PostgreSQL instance (Railway-provisioned)
- **Deployment trigger**: Automatic on push to `staging` branch

### Production
- **Purpose**: Live user-facing application
- **URL**: `https://umarell.app` (custom domain) or `https://umarell-production.up.railway.app`
- **Database**: Dedicated PostgreSQL instance (Railway-provisioned, separate from staging)
- **Deployment trigger**: Automatic on push to `production` branch

## Branch and Release Flow

```
main → staging branch → production branch
```

1. **Development**: All work commits directly to `main` (trunk-based development)
2. **Staging deployment**: Merge `main` → `staging` triggers staging deployment
3. **Production promotion**: Merge `staging` → `production` triggers production deployment

### Rationale
- Trunk-based development on `main` keeps development velocity high
- Explicit promotion branches (`staging`, `production`) create deployment boundaries
- Each merge is an intentional promotion event with clear commit history

## Environment Variables and Secrets

### Shared (both environments)
- `ANTHROPIC_API_KEY` — Claude API key for AI processing
- `GOOGLE_CLIENT_ID` — OAuth client ID (can be same or different per environment)
- `GOOGLE_CLIENT_SECRET` — OAuth secret
- `JWT_SECRET` — Session token signing key (unique per environment)
- `CORS_ORIGINS` — Comma-separated allowed origins

### Staging-specific
- `DATABASE_URL` — PostgreSQL connection string (Railway-injected)
- `VITE_API_URL` — Frontend API endpoint (`https://umarell-staging.up.railway.app`)
- `ALLOWED_PHONE_NUMBERS` — Comma-separated test phone numbers for WhatsApp/SMS features

### Production-specific
- `DATABASE_URL` — PostgreSQL connection string (Railway-injected)
- `VITE_API_URL` — Frontend API endpoint (`https://umarell.app`)
- `SENTRY_DSN` — Error tracking (production only)

### Notes on secrets
- Store all secrets in Railway's environment variable UI
- Never commit secrets to the repository
- `JWT_SECRET` must be different between staging and production
- Consider separate Google OAuth apps for staging vs production to control redirect URIs

## Railway Service Configuration

Each environment deploys two services:

### API Service
- **Root directory**: `/api`
- **Build command**: (handled by Dockerfile)
- **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Port**: Railway-assigned via `$PORT`
- **Health check**: `GET /health`

### Frontend Service
- **Root directory**: `/app`
- **Build command**: `npm install && npm run build`
- **Start command**: `npm run preview`
- **Port**: Railway-assigned via `$PORT`
- **Environment variables**: `VITE_API_URL` set to API service URL

## Database Migration Strategy

- Use Alembic for schema migrations (to be implemented)
- Migrations run automatically as part of API service startup
- Staging receives migrations first; production only after validation

## Promotion Path

```
1. Work happens on main
2. To deploy to staging: git merge main into staging, git push staging
3. Validate on staging (manual testing, smoke tests)
4. To deploy to production: git merge staging into production, git push production
5. Monitor production for issues
```

If a critical bug reaches production:
- Fix on `main`
- Merge to `staging`, validate quickly
- Fast-follow merge to `production`

## Open Questions

- Should we use Railway's PR environments for throwaway preview deployments?
- Do we need a CI/CD step (GitHub Actions) or rely on Railway's built-in deployment?
- Should we set up automated smoke tests that run post-deployment?
