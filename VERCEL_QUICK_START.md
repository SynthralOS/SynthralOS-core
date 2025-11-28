# Vercel Deployment - Quick Start

**Status:** ✅ **Ready to Deploy**

---

## 🚀 Quick Deploy (5 Steps)

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login
```bash
vercel login
```

### 3. Set Environment Variables
Go to https://vercel.com/dashboard → Your Project → Settings → Environment Variables

**Add these 10 required:**
- `DATABASE_URL` (use Supabase pooler: port 6543)
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `NANGO_SECRET_KEY`
- `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`)
- `RESEND_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (generate: `openssl rand -hex 32`)

### 4. Deploy
```bash
vercel --prod
```

### 5. Verify
- Health: `https://your-app.vercel.app/health`
- Frontend: `https://your-app.vercel.app/`
- API: `https://your-app.vercel.app/api/v1`

---

## ⚠️ **Before Deploying - Code Updates Needed**

### 1. Update WebSocket → Polling

**Find and replace in frontend:**
- Replace Socket.IO subscriptions with polling
- Use `pollExecutionStatus()` from `@/lib/polling`

### 2. Update Database Connection

**Ensure using pooler for serverless:**
- Database config auto-detects Vercel now
- Uses Supabase pooler automatically

### 3. Test Locally First

```bash
vercel dev
```

---

## 📋 Files Created

- ✅ `vercel.json` - Vercel configuration
- ✅ `api/index.ts` - Serverless function entry
- ✅ `api/[...path].ts` - Catch-all handler
- ✅ `api/cron/*.ts` - Cron jobs
- ✅ `api/poll/execution-status.ts` - Polling endpoint
- ✅ `frontend/src/lib/polling.ts` - Polling utility

---

## 🔧 What Changed

1. **WebSockets → Polling** (serverless doesn't support WebSockets)
2. **Background Jobs → Vercel Cron** (replaces BullMQ scheduler)
3. **Database → Pooler** (auto-detects serverless, uses pooler)
4. **Static Files → Vercel CDN** (automatic)

---

## ✅ **Ready!**

Deploy with: `vercel --prod`

**For detailed guide, see `VERCEL_DEPLOYMENT_GUIDE.md`**

