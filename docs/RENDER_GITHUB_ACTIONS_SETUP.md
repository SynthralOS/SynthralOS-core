# Render Deployment via GitHub Actions

This guide explains how to set up automated deployments to Render using GitHub Actions, similar to the Fly.io deployment workflow.

## Prerequisites

1. ✅ **Render Account** - Sign up at [render.com](https://render.com)
2. ✅ **Render Service Created** - Your service should already be set up on Render
3. ✅ **GitHub Repository** - Your code pushed to GitHub

## Setup Steps

### Step 1: Create a Deploy Hook in Render

1. Go to your [Render Dashboard](https://dashboard.render.com)
2. Select your service (e.g., `sos-backend`)
3. Navigate to **Settings** → **Deploy Hooks**
4. Click **"Create Deploy Hook"**
5. Give it a name (e.g., "GitHub Actions Deploy")
6. Copy the **Deploy Hook URL** (it will look like: `https://api.render.com/deploy/srv-xxxxx?key=xxxxx`)

### Step 2: Add Deploy Hook to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `RENDER_DEPLOY_HOOK`
5. Value: Paste the Deploy Hook URL from Step 1
6. Click **"Add secret"**

### Step 3: Verify Workflow File

The workflow file `.github/workflows/render-deploy.yml` is already created and will:
- Trigger on pushes to `main` branch
- Trigger manually via `workflow_dispatch`
- Call Render's deploy hook API to trigger a deployment

### Step 4: Test the Deployment

1. Make a commit and push to `main`:
   ```bash
   git add .
   git commit -m "Test Render deployment"
   git push origin main
   ```

2. Check GitHub Actions:
   - Go to your repository → **Actions** tab
   - You should see "Deploy to Render" workflow running
   - It should complete successfully

3. Check Render Dashboard:
   - Go to your Render service
   - You should see a new deployment triggered
   - Monitor the build logs

## How It Works

The GitHub Actions workflow:
1. **Triggers** on push to `main` or manual dispatch
2. **Checks out** your code
3. **Calls** Render's deploy hook API via `curl`
4. **Verifies** the response (HTTP 200/201 = success)

Render then:
1. **Pulls** the latest code from GitHub
2. **Runs** the build command from `render.yaml`
3. **Deploys** the new version
4. **Performs** health checks

## Differences from Fly.io

| Feature | Fly.io | Render |
|---------|--------|--------|
| **Deployment Method** | Direct CLI (`flyctl deploy`) | Deploy Hook API |
| **Build Location** | Fly.io builders | Render's infrastructure |
| **Configuration** | `fly.toml` + `Dockerfile` | `render.yaml` |
| **Secret Required** | `FLY_API_TOKEN` | `RENDER_DEPLOY_HOOK` |

## Troubleshooting

### Deployment Not Triggering

- ✅ Check that `RENDER_DEPLOY_HOOK` secret is set correctly
- ✅ Verify the deploy hook URL is valid (test it manually with `curl`)
- ✅ Check GitHub Actions logs for errors

### Build Failing on Render

- ✅ Check Render dashboard build logs
- ✅ Verify `render.yaml` configuration is correct
- ✅ Ensure all required environment variables are set in Render dashboard

### Manual Deployment

You can also trigger deployments manually:
1. Go to GitHub → **Actions** → **Deploy to Render**
2. Click **"Run workflow"**
3. Select branch and click **"Run workflow"**

## Alternative: Native Render GitHub Integration

Render also has native GitHub integration that automatically deploys on push. However, using GitHub Actions gives you:
- ✅ More control over deployment timing
- ✅ Ability to run tests before deployment
- ✅ Integration with other CI/CD steps
- ✅ Consistent deployment process across platforms (Fly.io + Render)

## Next Steps

- Set up both Fly.io and Render deployments to run in parallel
- Add deployment status badges to your README
- Configure deployment notifications

