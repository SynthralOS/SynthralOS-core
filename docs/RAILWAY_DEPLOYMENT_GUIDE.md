# Railway Deployment Guide

This guide covers deploying the SynthralOS platform to Railway.

## Why Railway?

- ✅ **Simple setup** - Just connect GitHub and deploy
- ✅ **Docker support** - Uses Dockerfile for consistent builds
- ✅ **Built-in services** - PostgreSQL and Redis available
- ✅ **Auto-deploys** - Automatic deployments on push
- ✅ **Free tier** - $5 credit/month for testing
- ✅ **Monorepo support** - Handles workspaces automatically

## Prerequisites

1. ✅ **Railway Account** - Sign up at [railway.app](https://railway.app)
2. ✅ **GitHub Repository** - Your code pushed to GitHub
3. ✅ **Railway CLI** (optional) - For local testing

## Quick Setup

### Step 1: Sign up for Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Authorize Railway to access your repositories

### Step 2: Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose your repository: `SynthralOS/SynthralOS-core`
4. Railway will automatically:
   - Detect it's a Node.js application
   - Use `railway.json` configuration
   - Set up auto-deployment on push to `main`

### Step 3: Configure Service (Optional)
Railway will auto-detect settings from `railway.json`:
- **Build Command**: `npm ci --legacy-peer-deps --no-audit --no-fund && npm run build`
- **Start Command**: `npm start`
- **Root Directory**: `.` (root)

You can adjust these in Railway dashboard if needed.

### Step 4: Add Environment Variables
1. Go to your service → **Variables** tab
2. Add all required environment variables (see below)
3. Railway will automatically redeploy when you save

### Step 5: Add Redis Service (Optional)
1. Click **"+ New"** → **"Database"** → **"Redis"**
2. Railway will auto-inject `REDIS_URL` environment variable
3. Link Redis service to your backend service

### Step 6: Deploy
- Railway automatically deploys on every push to `main` branch
- Check deployment logs in the Railway dashboard
- Monitor build and runtime logs

## Environment Variables

Add these to your Railway service:

### Required Variables

```bash
# Server
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:password@host:5432/postgres

# Redis (Auto-set if using Railway Redis)
REDIS_URL=redis://default:password@host:6379

# Authentication (Clerk)
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Email Service
RESEND_API_KEY=re_...

# Nango OAuth
NANGO_SECRET_KEY=nango_sk_...
NANGO_HOST=https://api.nango.dev

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# CORS
CORS_ORIGIN=https://your-app.railway.app
```

### Optional Variables

```bash
# OpenTelemetry
OTEL_ENABLED=false
OTEL_SERVICE_NAME=sos-backend
OTEL_EXPORTER_OTLP_ENDPOINT=https://...

# PostHog
POSTHOG_API_KEY=ph_...
POSTHOG_HOST=https://app.posthog.com

# JWT Secret (auto-generated if not set)
JWT_SECRET=your-secret-key
```

## Automatic Deployment

Railway automatically deploys when you:
- Push to the `main` branch
- Merge a pull request to `main`
- Manually trigger deployment from Railway dashboard

### Verify Deployment

After pushing to `main`:
1. Check Railway dashboard - deployment should start automatically
2. Monitor build logs in Railway dashboard
3. Check deployment status
4. Test your application URL once deployment completes

## Configuration Files

### railway.json

Railway uses `railway.json` for configuration:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci --legacy-peer-deps --no-audit --no-fund && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Railway will automatically use this configuration when you connect your GitHub repository.

## Railway vs Render

| Feature | Railway | Render |
|---------|---------|--------|
| **Setup** | ⭐⭐⭐⭐⭐ Very Easy | ⭐⭐⭐⭐ Easy |
| **Build** | Nixpacks or Docker | Native or Docker |
| **Auto-deploy** | ✅ Yes | ✅ Yes |
| **Free Tier** | $5 credit/month | Limited free tier |
| **PostgreSQL** | ✅ Built-in | ✅ Built-in |
| **Redis** | ✅ Built-in | ✅ Built-in |
| **WebSockets** | ✅ Supported | ✅ Supported |
| **Docker** | ✅ Supported | ✅ Supported |
| **Monorepo** | ✅ Supported | ✅ Supported |

## Troubleshooting

### Build Fails

- Check Railway build logs
- Verify `railway.json` configuration
- Ensure all dependencies are in `package.json`
- Check Node.js version compatibility

### Application Not Starting

- Check Railway runtime logs
- Verify `PORT` environment variable (Railway sets this automatically)
- Ensure server binds to `0.0.0.0` (already configured)
- Check health check endpoint: `/health`

### Environment Variables Not Working

- Verify variables are set in Railway dashboard
- Check variable names match exactly
- Restart service after adding variables
- Check logs for missing variable errors

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check if using Railway PostgreSQL or external (Supabase)
- Ensure database is accessible from Railway
- Check connection pooling settings

## Migration from Render

If migrating from Render:

1. **Export environment variables** from Render dashboard
2. **Create Railway project** and deploy
3. **Import environment variables** to Railway
4. **Update CORS_ORIGIN** to Railway app URL
5. **Update Nango callbacks** to Railway backend URL
6. **Update Clerk redirects** to Railway frontend URL
7. **Test deployment**
8. **Update DNS** (if using custom domain)

## Next Steps

1. ✅ Set up Railway project
2. ✅ Add environment variables
3. ✅ Configure GitHub Actions (add `RAILWAY_TOKEN` secret)
4. ✅ Push to `main` to trigger deployment
5. ✅ Monitor deployment in Railway dashboard
6. ✅ Test your application

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app

