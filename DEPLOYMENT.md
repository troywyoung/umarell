# Deployment Guide

This guide documents how to set up and deploy Umarell to Railway.

## Prerequisites

- Railway account (https://railway.app)
- Access to environment secrets (Anthropic API key, Google OAuth credentials, JWT secret)

## Initial Setup

### 1. Create Railway Projects

Create two separate Railway projects:
- **umarell-staging** — for staging environment
- **umarell-production** — for production environment

### 2. Configure Staging Environment

In the Railway dashboard for **umarell-staging**:

#### Add PostgreSQL Database
1. Click "New" → "Database" → "PostgreSQL"
2. Railway will automatically provision and inject `DATABASE_URL`

#### Create API Service
1. Click "New" → "GitHub Repo" → Connect this repository
2. Configure service:
   - **Name**: `api`
   - **Root Directory**: `/api`
   - **Watch Paths**: `/api/**`
   - **Branch**: `staging`
   - **Dockerfile Path**: `/api/Dockerfile`
3. Add environment variables:
   - `ANTHROPIC_API_KEY` — your Claude API key
   - `GOOGLE_CLIENT_ID` — OAuth client ID
   - `GOOGLE_CLIENT_SECRET` — OAuth client secret
   - `JWT_SECRET` — generate unique secret for staging
   - `CORS_ORIGINS` — comma-separated allowed origins
4. Configure health check:
   - **Path**: `/health`
   - **Timeout**: 100s

#### Create Frontend Service
1. Click "New" → "GitHub Repo" → Connect this repository
2. Configure service:
   - **Name**: `app`
   - **Root Directory**: `/app`
   - **Watch Paths**: `/app/**`
   - **Branch**: `staging`
   - **Dockerfile Path**: `/app/Dockerfile`
3. Add environment variables:
   - `VITE_API_URL` — set to the API service URL (e.g., `https://api-staging-umarell.up.railway.app`)
4. Expose public domain and note the URL (e.g., `https://umarell-staging.up.railway.app`)

### 3. Configure Production Environment

Repeat the same steps for **umarell-production** project, with these differences:
- **Branch**: `production` (create this branch when ready)
- **JWT_SECRET**: Use a different secret than staging
- **VITE_API_URL**: Point to production API service URL
- **Custom domain**: Add `umarell.app` to frontend service (requires DNS configuration)

## Deployment Workflow

### Deploy to Staging

```bash
# Ensure staging branch exists
git checkout staging || git checkout -b staging
git merge main
git push origin staging
```

Railway will automatically detect the push and deploy both services.

### Deploy to Production

Production deployments should only happen after staging validation. Follow this workflow:

#### Pre-deployment Checklist
- [ ] Changes have been deployed to staging
- [ ] Manual testing completed on staging
- [ ] No known critical bugs in staging
- [ ] Database migrations (if any) have been tested in staging
- [ ] All team members notified of upcoming deployment

#### Production Deploy Steps

```bash
# 1. Ensure you're on staging with latest changes
git checkout staging
git pull origin staging

# 2. Switch to production branch (create if first time)
git checkout production || git checkout -b production

# 3. Merge staging into production
git merge staging

# 4. Push to trigger deployment
git push origin production
```

Railway will automatically detect the push and deploy both services.

#### Post-deployment Verification
1. **API Health**: Check `https://[production-api-url]/health` returns 200
2. **Frontend**: Verify app loads at `https://umarell.app`
3. **Authentication**: Test Google OAuth login flow
4. **Core functionality**: Submit a test observation and verify research completes
5. **Monitor logs**: Watch Railway logs for 10-15 minutes for errors

### Rollback Procedures

If a production deployment introduces critical issues, rollback immediately.

#### Option 1: Railway UI Rollback (Fastest)

1. Open Railway dashboard for production project
2. Click on the service (API or App) with issues
3. Go to "Deployments" tab
4. Find the last known good deployment
5. Click "Redeploy" on that deployment
6. Repeat for other service if needed

**Timeframe**: ~2-3 minutes

#### Option 2: Git Revert (For Full Rollback)

```bash
# 1. Identify the problematic merge commit
git checkout production
git log --oneline -10

# 2. Revert the merge commit (use the commit hash from merge)
git revert -m 1 <merge-commit-hash>

# 3. Push to trigger redeployment
git push origin production
```

**Timeframe**: ~5-10 minutes (includes rebuild)

#### Option 3: Hard Reset (Emergency Only)

```bash
# 1. Find the last known good commit
git checkout production
git log --oneline -10

# 2. Hard reset to that commit
git reset --hard <good-commit-hash>

# 3. Force push (THIS REWRITES HISTORY)
git push --force origin production
```

**⚠️ Warning**: Only use this in emergencies. Requires coordination with all team members.

**Timeframe**: ~5-10 minutes (includes rebuild)

#### Post-Rollback Steps

1. **Verify rollback**: Check health endpoints and core functionality
2. **Communicate**: Notify team that rollback is complete
3. **Root cause analysis**: Investigate what went wrong
4. **Fix forward**: Create fix on `main`, test in staging, re-deploy to production

## Verification

After deployment:

1. **API Health Check**: Visit `https://[api-url]/health`
2. **Frontend**: Visit the app URL and verify it loads
3. **Database**: Check Railway logs to ensure database connection succeeded
4. **OAuth**: Test Google login flow

## Troubleshooting

### Deployment Fails

- Check Railway logs for build errors
- Verify environment variables are set correctly
- Ensure Dockerfile paths are correct

### Database Connection Issues

- Verify `DATABASE_URL` is injected by Railway
- Check API logs for connection errors
- Ensure PostgreSQL service is running

### Frontend Can't Reach API

- Verify `VITE_API_URL` is set correctly
- Check CORS_ORIGINS includes the frontend URL
- Verify API service is deployed and healthy

## Railway Service URLs

After setup, document your service URLs here:

### Staging
- API: `https://[generated-url].up.railway.app`
- App: `https://umarell-staging.up.railway.app`

### Production
- API: `https://[generated-url].up.railway.app`
- App: `https://umarell.app` (custom domain)
