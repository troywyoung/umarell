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

```bash
# Ensure production branch exists
git checkout production || git checkout -b production
git merge staging
git push origin production
```

Railway will automatically detect the push and deploy both services.

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
