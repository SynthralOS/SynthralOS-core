# Clerk Cloudflare Tunnel Setup

## Issue
When accessing the app through a Cloudflare tunnel, Clerk shows a multi-step login flow (email first, then password on separate page) instead of showing both fields together like on localhost. After entering email and clicking continue, users are redirected to `/login/factor-one` which doesn't allow password entry.

## Root Cause
Clerk doesn't recognize the Cloudflare tunnel domain as an allowed origin, so it defaults to a different authentication flow.

## Solution

You need to add the Cloudflare tunnel URL to Clerk's allowed origins and redirect URLs in the Clerk Dashboard.

### Steps:

1. **Go to Clerk Dashboard**: https://dashboard.clerk.com
2. **Select your application**
3. **Go to**: Settings → Paths
4. **Add to "Allowed Redirect URLs"**:
   ```
   https://quick-violin-poker-record.trycloudflare.com/*
   https://*.trycloudflare.com/*
   ```
5. **Go to**: Settings → Domains
6. **Add to "Allowed Origins"** (or "Frontend API" settings):
   ```
   https://quick-violin-poker-record.trycloudflare.com
   https://*.trycloudflare.com
   ```
7. **Save the changes**

### Important Notes:
- The tunnel URL changes each time you restart the tunnel
- Adding `https://*.trycloudflare.com/*` as a wildcard will allow all Cloudflare tunnel URLs
- This is safe for development/testing purposes
- After adding the URLs, wait a few minutes for Clerk to update, then refresh your app

### Alternative: Use a Fixed Domain
For production, consider:
- Using a custom domain with Cloudflare Tunnel
- Or using a service like ngrok with a fixed domain
- Or deploying to a platform like Render/Upsun with a fixed domain

## Current Tunnel URLs

**Frontend**: https://quick-violin-poker-record.trycloudflare.com  
**Backend API**: https://bass-mins-llp-dividend.trycloudflare.com

## After Configuration

Once you've added the tunnel URL to Clerk:
1. Wait 2-3 minutes for changes to propagate
2. Clear your browser cache or use incognito mode
3. Try logging in again - it should now show email and password fields together

