# Vercel Serverless Deployment Guide

**Date:** 2024-12-27  
**Status:** ✅ **Codebase Converted to Serverless Functions**

---

## ✅ What's Been Converted

### 1. Serverless Function Structure
- ✅ `api/index.ts` - Express app wrapper for serverless
- ✅ `api/[...path].ts` - Catch-all route handler
- ✅ `vercel.json` - Vercel configuration

### 2. Cron Jobs (Replaces Scheduler)
- ✅ `api/cron/scheduled-workflows.ts` - Scheduled workflow execution
- ✅ `api/cron/cleanup-retention.ts` - Retention policy cleanup
- ✅ `api/cron/cleanup-audit-logs.ts` - Audit log cleanup

### 3. Polling Endpoint (Replaces WebSocket)
- ✅ `api/poll/execution-status.ts` - Execution status polling
- ✅ `frontend/src/lib/polling.ts` - Frontend polling utility

### 4. Database Configuration
- ✅ `backend/src/config/database.serverless.ts` - Serverless-optimized DB config

---

## ⚠️ **IMPORTANT CHANGES REQUIRED**

### 1. WebSockets → Polling

**Before (WebSocket):**
```typescript
socket.on('execution:subscribe', (executionId) => {
  socket.join(`execution:${executionId}`);
});
```

**After (Polling):**
```typescript
import { pollExecutionStatus } from '@/lib/polling';

const cancelPoll = pollExecutionStatus(executionId, {
  onUpdate: (data) => {
    // Update UI with execution status
  },
  onComplete: (data) => {
    // Handle completion
    cancelPoll();
  },
});
```

### 2. Background Jobs → Vercel Cron

**Before (BullMQ):**
```typescript
await queue.add('workflow-execution', { workflowId });
```

**After (Vercel Cron):**
- Use `vercel.json` cron configuration
- Or use external service (Inngest, Trigger.dev)

### 3. Database Connection

**Update your code to use serverless config:**
```typescript
// In serverless functions, use:
import { db } from '../backend/src/config/database.serverless';
```

**Or update `database.ts` to auto-detect:**
```typescript
// Use pooler for serverless
if (process.env.VERCEL) {
  // Use pooler connection
}
```

---

## 🚀 Deployment Steps

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Set Environment Variables

```bash
vercel env add DATABASE_URL
vercel env add CLERK_SECRET_KEY
vercel env add CLERK_PUBLISHABLE_KEY
vercel env add NANGO_SECRET_KEY
vercel env add OPENAI_API_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add RESEND_API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add CRON_SECRET  # For cron job authentication
```

**Or set in Vercel Dashboard:**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add all required variables

### Step 4: Deploy

```bash
vercel
```

**Or connect GitHub:**
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Vercel will auto-detect `vercel.json`
4. Deploy!

---

## 📋 Required Environment Variables

### **MUST SET:**
1. `DATABASE_URL` - PostgreSQL (use Supabase pooler: port 6543)
2. `CLERK_SECRET_KEY` - Clerk authentication
3. `CLERK_PUBLISHABLE_KEY` - Clerk frontend key
4. `NANGO_SECRET_KEY` - OAuth connectors
5. `OPENAI_API_KEY` OR `ANTHROPIC_API_KEY` - AI features
6. `RESEND_API_KEY` - Email sending
7. `SUPABASE_URL` - Supabase project URL
8. `SUPABASE_ANON_KEY` - Supabase anonymous key
9. `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
10. `CRON_SECRET` - Secret for cron job authentication (generate random string)

### **OPTIONAL:**
- `REDIS_URL` - Only if using Redis (consider Upstash for serverless)
- `POSTHOG_API_KEY` - Analytics
- `RUDDERSTACK_WRITE_KEY` - Event forwarding
- All other keys from `API_KEYS_COMPLETE_LIST.md`

---

## 🔧 Code Updates Needed

### 1. Update Database Imports

**In routes that use database:**
```typescript
// Change from:
import { db } from '../config/database';

// To (for serverless):
import { db } from '../config/database.serverless';
```

**Or update `database.ts` to auto-detect:**
```typescript
// At top of database.ts
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

if (isServerless) {
  // Use pooler connection
  // ... pooler config
} else {
  // Use direct connection
  // ... direct config
}
```

### 2. Update WebSocket Usage

**Replace WebSocket subscriptions with polling:**

**Frontend:**
```typescript
// Old (WebSocket):
socket.emit('execution:subscribe', executionId);
socket.on('execution:event', (event) => {
  // Handle event
});

// New (Polling):
import { pollExecutionStatus } from '@/lib/polling';

const cancelPoll = pollExecutionStatus(executionId, {
  interval: 2000, // Poll every 2 seconds
  onUpdate: (data) => {
    // Update UI
  },
  onComplete: (data) => {
    // Handle completion
    cancelPoll();
  },
});
```

### 3. Update Background Jobs

**Replace BullMQ with Vercel Cron or external service:**

**Option A: Vercel Cron (for scheduled workflows)**
- Already configured in `vercel.json`
- Cron jobs run at specified intervals

**Option B: External Queue Service**
- Use Inngest, Trigger.dev, or similar
- For async job processing

### 4. Remove Socket.IO Dependencies

**In routes that emit WebSocket events:**
```typescript
// Remove:
import { websocketService } from '../services/websocketService';
websocketService.emitExecutionEvent(executionId, event);

// Replace with:
// Status is now available via polling endpoint
// Or use external service (Pusher, Ably) if needed
```

---

## 🏗️ Architecture Changes

### Before (Render - Monolithic):
```
┌─────────────────┐
│  Express Server │
│  - API Routes   │
│  - WebSockets   │
│  - Background   │
│  - Static Files │
└─────────────────┘
```

### After (Vercel - Serverless):
```
┌─────────────────┐
│  Serverless     │
│  Functions      │
│  - API Routes   │
│  - Cron Jobs    │
└─────────────────┘
         │
         ├─→ Polling (replaces WebSocket)
         ├─→ External Queue (replaces BullMQ)
         └─→ Static Files (Vercel CDN)
```

---

## ⚠️ Limitations & Solutions

### 1. **WebSockets Not Supported**
- **Solution:** Use polling (implemented) or external service (Pusher/Ably)

### 2. **Background Jobs Limited**
- **Solution:** Use Vercel Cron (implemented) or external queue (Inngest/Trigger.dev)

### 3. **Long-Running Tasks (60s max)**
- **Solution:** Break into chunks or use external workers

### 4. **File System Read-Only**
- **Solution:** Use Supabase Storage (already configured)

### 5. **Connection Pooling**
- **Solution:** Use Supabase pooler (configured in `database.serverless.ts`)

---

## 🧪 Testing Locally

### Test Serverless Functions:

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally
vercel dev
```

This will:
- Start local serverless functions
- Serve frontend
- Simulate Vercel environment

---

## 📊 Performance Considerations

### Cold Starts:
- First request: ~1-3 seconds
- Subsequent: ~100-500ms

### Optimization:
1. **Keep functions warm:** Use Vercel Pro plan
2. **Reduce bundle size:** Tree-shake dependencies
3. **Use edge functions:** For simple routes (if applicable)

---

## 🔍 Troubleshooting

### Issue: Functions timeout
- **Solution:** Increase `maxDuration` in `vercel.json` (max 60s on Pro)

### Issue: Database connection errors
- **Solution:** Use Supabase pooler (port 6543) instead of direct connection

### Issue: Cron jobs not running
- **Solution:** Verify `CRON_SECRET` is set and matches in cron handlers

### Issue: WebSocket errors
- **Solution:** Replace with polling (already implemented)

---

## ✅ Deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Database using pooler connection (port 6543)
- [ ] WebSocket code replaced with polling
- [ ] Background jobs moved to Vercel Cron or external service
- [ ] Test locally with `vercel dev`
- [ ] Deploy to Vercel
- [ ] Test health endpoint
- [ ] Test API endpoints
- [ ] Test polling endpoint
- [ ] Test cron jobs (wait for scheduled time)

---

## 🚀 **Ready to Deploy!**

The codebase has been converted to Vercel serverless functions. 

**Next Steps:**
1. Update database imports to use serverless config
2. Replace WebSocket usage with polling
3. Set environment variables in Vercel
4. Deploy!

**For detailed migration steps, see `VERCEL_MIGRATION_GUIDE.md`**

