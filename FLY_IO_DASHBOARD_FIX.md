# Fix Fly.io Build Configuration When Settings Not Visible

## The Problem

You can't find "Build Configuration" settings in Fly.io dashboard, but you're getting buildpack detection errors when deploying from GitHub.

## ✅ Solutions (Try in Order)

### Solution 1: Disconnect and Reconnect GitHub Repo

**This is the most reliable fix:**

1. Go to Fly.io Dashboard → Your app (`sos-hs5xqw`)
2. Look for **"Source"** or **"GitHub"** section (usually in Settings or Overview)
3. Click **"Disconnect"** or **"Remove"** to disconnect the GitHub repo
4. Click **"Connect GitHub"** or **"Add Source"**
5. When reconnecting:
   - Select your repository
   - **IMPORTANT:** When prompted for build method, select **"Dockerfile"**
   - **DO NOT** select "Auto-detect" or "Buildpack"
   - Specify Dockerfile path: `Dockerfile`
6. Save/Connect

This will set the build method to Docker permanently.

### Solution 2: Check Different Dashboard Sections

The build settings might be in different places:

- **Settings** → **Build & Deploy**
- **Settings** → **Build Configuration**  
- **Settings** → **Source** → **Build Settings**
- **Overview** → **Source** → **Configure Build**
- **Deployments** → **Build Settings**

### Solution 3: Use Fly.io CLI to Configure

If dashboard doesn't work, use CLI:

```bash
# This should save your fly.toml config to Fly.io
flyctl config save -a sos-hs5xqw

# Or try deploying once with explicit Docker flag
flyctl deploy -a sos-hs5xqw --dockerfile Dockerfile --remote-only
```

After running this once, GitHub deployments should use Docker.

### Solution 4: Create App with Docker from Start

If nothing works, you might need to:

1. **Delete the current app** (or create a new one)
2. **Create new app with Docker:**
   ```bash
   flyctl apps create sos-hs5xqw-new --org personal
   ```
3. **Connect GitHub** and select Docker during setup
4. **Update fly.toml** with new app name

### Solution 5: Use GitHub Actions Instead

If dashboard configuration is problematic, use GitHub Actions:

1. Create `.github/workflows/fly.yml`:
```yaml
name: Deploy to Fly.io
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only --dockerfile Dockerfile
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

2. Add `FLY_API_TOKEN` to GitHub Secrets
3. This bypasses dashboard build settings entirely

## Current fly.toml Configuration

Your `fly.toml` is correctly configured:
```toml
[build]
  dockerfile = "Dockerfile"
  ignorefile = ".flyignore"
```

This should work, but Fly.io might be scanning before reading it.

## Quick Test

Try pushing a small change to trigger a deployment. Sometimes Fly.io will read `fly.toml` on the next deployment even if it didn't before.

## Recommendation

**Try Solution 1 first** (Disconnect/Reconnect GitHub) - this is the most reliable way to set the build method permanently for GitHub deployments.

