# Vercel Serverless Migration Guide

**Date:** 2024-12-27  
**Status:** ⚠️ **Major Architectural Changes Required**

---

## ⚠️ Important Considerations

Converting to Vercel serverless functions requires significant architectural changes:

### **Challenges:**

1. **WebSockets (Socket.IO) - NOT SUPPORTED**
   - Vercel serverless functions don't support WebSockets
   - **Solution:** Use polling or separate WebSocket service (e.g., Pusher, Ably, or separate Node.js service)

2. **Background Jobs (BullMQ) - NOT SUPPORTED**
   - BullMQ requires persistent Redis connections
   - **Solution:** Use Vercel Cron Jobs or external service (e.g., Inngest, Trigger.dev, or separate worker service)

3. **Long-Running Processes - LIMITED**
   - Max execution time: 60 seconds (Pro plan) or 10 seconds (Hobby)
   - **Solution:** Break long tasks into smaller chunks or use external services

4. **Database Connections - NEEDS POOLING**
   - Each serverless function creates new connections
   - **Solution:** Use connection pooling (Supabase pooler recommended)

5. **File System - READ-ONLY**
   - Cannot write to filesystem
   - **Solution:** Use external storage (Supabase Storage, S3, etc.)

---

## 🏗️ Migration Strategy

### Option 1: Hybrid Approach (Recommended)

**Keep on Render:**
- WebSocket service (Socket.IO)
- Background job workers (BullMQ)
- Long-running processes

**Move to Vercel:**
- API endpoints (serverless functions)
- Frontend (static hosting)
- Short-lived operations

### Option 2: Full Vercel Migration

**Replace:**
- WebSockets → Polling or external service (Pusher/Ably)
- BullMQ → Vercel Cron + external queue (Inngest/Trigger.dev)
- Long tasks → Chunked execution or external workers

---

## 📋 Step-by-Step Migration

### Step 1: Create Vercel-Compatible Structure

```
/
├── api/                    # Vercel serverless functions
│   ├── index.ts            # Main Express app wrapper
│   └── [...path].ts        # Catch-all route handler
├── frontend/               # Frontend (served as static)
├── vercel.json             # Vercel configuration
└── backend/                 # Keep for shared code
```

### Step 2: Convert Routes to Serverless Functions

Each route becomes a serverless function in `/api` directory.

### Step 3: Update Database Connection

Use Supabase connection pooler for serverless:
```typescript
// Use pooler URL instead of direct connection
const connectionString = process.env.DATABASE_URL?.replace(
  ':5432',
  ':6543' // Pooler port
) || process.env.DATABASE_URL;
```

### Step 4: Handle WebSockets

**Option A: Polling (Simple)**
- Replace WebSocket subscriptions with polling
- Frontend polls `/api/v1/executions/:id/status` every 2-5 seconds

**Option B: External Service (Recommended)**
- Use Pusher, Ably, or similar
- Keep WebSocket service on Render for real-time features

### Step 5: Handle Background Jobs

**Option A: Vercel Cron**
- Use `vercel.json` cron configuration
- For scheduled workflows

**Option B: External Queue**
- Use Inngest, Trigger.dev, or similar
- For async job processing

---

## 🚀 Quick Start (Hybrid Approach)

### Keep on Render:
1. WebSocket service (port 4001)
2. Background job worker (port 4002)

### Deploy to Vercel:
1. API endpoints (serverless)
2. Frontend (static)

### Connect:
- Frontend → Vercel API (for REST)
- Frontend → Render WebSocket (for real-time)
- Vercel API → Render Worker (for background jobs)

---

## 📝 Implementation Files Created

1. `vercel.json` - Vercel configuration
2. `api/index.ts` - Express app wrapper for serverless
3. `api/[...path].ts` - Catch-all route handler

---

## ⚠️ Limitations to Address

1. **WebSockets:** Need alternative solution
2. **Background Jobs:** Need external queue service
3. **Long Tasks:** Need chunking or external workers
4. **File System:** Use external storage
5. **Connection Pooling:** Use Supabase pooler

---

## 🔄 Next Steps

1. **Decide on approach:** Hybrid vs Full migration
2. **Set up WebSocket alternative:** Polling or external service
3. **Set up background jobs:** Vercel Cron or external queue
4. **Test serverless functions:** Deploy to Vercel
5. **Update frontend:** Point to Vercel API

---

**Note:** This is a major architectural change. Consider the hybrid approach first to minimize disruption.

