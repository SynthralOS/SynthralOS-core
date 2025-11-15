# Performance Optimization Guide

This guide provides strategies and techniques for optimizing the observability system to meet the <150ms p95 overhead target.

## Target Metrics

- **P95 Latency**: <150ms overhead
- **P99 Latency**: <200ms overhead (stretch goal)
- **Error Rate**: <1%
- **Throughput**: Maintain baseline throughput

## Optimization Strategies

### 1. Async Processing

**Current Implementation**: ✅ Already async

All observability operations are non-blocking:
- Langfuse exports are async
- RudderStack forwarding is queued
- Database writes are async
- Trace processing is batched

**Optimization Tips**:
- Ensure no `await` blocks the main thread
- Use `Promise.allSettled` for parallel operations
- Avoid synchronous file I/O

### 2. Batching

**Current Implementation**: ✅ Batched (20 events)

**Optimization Options**:

#### Increase Batch Size
```typescript
// In rudderstackService.ts
private batchSize: number = 50; // Increase from 20 to 50
```

**Trade-offs**:
- ✅ Fewer API calls
- ✅ Better throughput
- ⚠️ Higher memory usage
- ⚠️ Longer delay before sending

#### Adaptive Batching
```typescript
// Adjust batch size based on load
private getBatchSize(): number {
  const queueLength = this.eventQueue.length;
  if (queueLength > 100) return 50;
  if (queueLength > 50) return 30;
  return 20;
}
```

### 3. Caching

**Current Implementation**: ✅ Feature flags cached

**Additional Caching Opportunities**:

#### Policy Evaluation Cache
```typescript
// Cache policy evaluation results
private policyCache: Map<string, PolicyEvaluationResult> = new Map();
private cacheTTL = 60 * 1000; // 1 minute

async evaluatePolicies(context: PolicyContext): Promise<PolicyEvaluationResult> {
  const cacheKey = this.getCacheKey(context);
  const cached = this.policyCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
    return cached.result;
  }
  
  const result = await this.evaluatePoliciesInternal(context);
  this.policyCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}
```

#### Cost Calculation Cache
```typescript
// Cache cost calculations (pricing rarely changes)
private costCache: Map<string, CostCalculationResult> = new Map();

calculate(input: CostCalculationInput): CostCalculationResult {
  const cacheKey = `${input.provider}:${input.model}`;
  const cached = this.costCache.get(cacheKey);
  
  if (cached) return cached;
  
  const result = this.calculateInternal(input);
  this.costCache.set(cacheKey, result);
  return result;
}
```

### 4. Database Optimization

#### Connection Pooling
```typescript
// Ensure proper connection pooling
const pool = new Pool({
  max: 20, // Maximum connections
  min: 5,  // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### Batch Inserts
```typescript
// Batch multiple inserts
async batchInsertCostLogs(logs: CostLog[]): Promise<void> {
  const values = logs.map(log => `(${log.userId}, ${log.cost}, ...)`).join(',');
  await db.query(`INSERT INTO model_cost_logs VALUES ${values}`);
}
```

#### Indexes
Ensure proper indexes exist:
```sql
CREATE INDEX idx_model_cost_logs_user_timestamp ON model_cost_logs(user_id, timestamp);
CREATE INDEX idx_event_logs_workspace_timestamp ON event_logs(workspace_id, timestamp);
```

### 5. Queue Management

#### Queue Size Limits
```typescript
// Prevent unbounded queue growth
private maxQueueSize: number = 10000;

track(event: RudderStackEvent): void {
  if (this.eventQueue.length >= this.maxQueueSize) {
    // Drop oldest events or reject new ones
    this.eventQueue.shift(); // Drop oldest
    // OR
    // throw new Error('Queue full'); // Reject new
  }
  this.eventQueue.push(event);
}
```

#### Priority Queues
```typescript
// Process high-priority events first
interface QueuedEvent {
  event: RudderStackEvent;
  priority: number; // Higher = more important
  retries: number;
  lastAttempt: number;
}

private processQueue(): void {
  // Sort by priority
  this.eventQueue.sort((a, b) => b.priority - a.priority);
  // Process high-priority first
}
```

### 6. Parallel Processing

**Current Implementation**: ✅ Uses Promise.allSettled

**Optimization**:
```typescript
// Process batches in parallel (with concurrency limit)
async processBatches(batches: QueuedEvent[][]): Promise<void> {
  const concurrency = 5; // Process 5 batches at a time
  for (let i = 0; i < batches.length; i += concurrency) {
    const batchGroup = batches.slice(i, i + concurrency);
    await Promise.allSettled(
      batchGroup.map(batch => this.processBatch(batch))
    );
  }
}
```

### 7. Conditional Execution

**Current Implementation**: ✅ Feature flags

**Additional Optimizations**:

#### Sampling
```typescript
// Sample events instead of logging all
private sampleRate: number = 0.1; // 10% sampling

shouldLog(): boolean {
  return Math.random() < this.sampleRate;
}

async logEvent(event: Event): Promise<void> {
  if (!this.shouldLog()) return; // Skip 90% of events
  // ... log event
}
```

#### Conditional Tracing
```typescript
// Only trace slow requests
if (duration > 1000) { // Only trace if > 1 second
  await this.exportTrace(trace);
}
```

### 8. Memory Management

#### Cleanup Old Data
```typescript
// Periodically clean up old cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of this.cache.entries()) {
    if (now - value.timestamp > this.cacheTTL) {
      this.cache.delete(key);
    }
  }
}, 60000); // Every minute
```

#### Weak References
```typescript
// Use WeakMap for temporary data
private tempData = new WeakMap<object, any>();
```

### 9. Network Optimization

#### Connection Reuse
```typescript
// Reuse HTTP connections
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
});

const client = axios.create({
  httpsAgent: agent,
  timeout: 5000, // 5 second timeout
});
```

#### Compression
```typescript
// Compress large payloads
import zlib from 'zlib';

const compressed = zlib.gzipSync(JSON.stringify(largeData));
```

### 10. Monitoring and Profiling

#### Performance Monitoring
```typescript
// Track performance metrics
const performanceMetrics = {
  langfuseExportTime: [],
  rudderstackExportTime: [],
  databaseWriteTime: [],
};

async exportToLangfuse(trace: Trace): Promise<void> {
  const start = Date.now();
  try {
    await langfuseService.exportTrace(trace);
  } finally {
    const duration = Date.now() - start;
    performanceMetrics.langfuseExportTime.push(duration);
    
    // Alert if slow
    if (duration > 100) {
      console.warn(`Slow Langfuse export: ${duration}ms`);
    }
  }
}
```

#### Profiling
```typescript
// Use Node.js profiler
import { performance } from 'perf_hooks';

const mark1 = performance.mark('start');
// ... operation
const mark2 = performance.mark('end');
performance.measure('operation', 'start', 'end');
const measure = performance.getEntriesByName('operation')[0];
console.log(`Operation took ${measure.duration}ms`);
```

## Optimization Checklist

Use this checklist when optimizing:

- [ ] All operations are async
- [ ] Batch sizes are optimized
- [ ] Caching is implemented where appropriate
- [ ] Database connections are pooled
- [ ] Indexes are created
- [ ] Queue sizes are limited
- [ ] Parallel processing is used
- [ ] Conditional execution is implemented
- [ ] Memory is managed properly
- [ ] Network connections are reused
- [ ] Performance is monitored
- [ ] Profiling is done regularly

## Measurement and Validation

### Before Optimization
1. Run load test: `node backend/scripts/load-test.js`
2. Record baseline metrics
3. Identify bottlenecks

### After Optimization
1. Run load test again
2. Compare metrics
3. Verify target is met
4. Check for regressions

### Metrics to Track
- P50, P95, P99 latencies
- Mean latency
- Error rate
- Throughput
- Memory usage
- CPU usage
- Queue sizes

## Common Optimizations

### Quick Wins

1. **Increase Batch Sizes** (if memory allows)
   - Langfuse: 20 → 50
   - RudderStack: 20 → 50

2. **Enable Caching**
   - Policy evaluation
   - Cost calculations
   - Feature flags (already done)

3. **Add Indexes**
   - User + timestamp indexes
   - Workspace + timestamp indexes

4. **Optimize Database Queries**
   - Use prepared statements
   - Batch inserts
   - Limit result sets

### Advanced Optimizations

1. **Implement Sampling**
   - Sample 10% of events
   - Full trace only for errors

2. **Use Message Queues**
   - Move to Redis/BullMQ
   - Async processing workers

3. **Implement Circuit Breakers**
   - Fail fast on external service issues
   - Prevent cascade failures

4. **Use CDN/Caching Layer**
   - Cache static data
   - Reduce database load

## Testing Optimizations

### A/B Testing
```typescript
// Test different configurations
const configs = [
  { batchSize: 20, cacheTTL: 60000 },
  { batchSize: 50, cacheTTL: 120000 },
  { batchSize: 30, cacheTTL: 90000 },
];

for (const config of configs) {
  // Run load test with config
  // Compare results
}
```

### Gradual Rollout
1. Enable optimization for 10% of traffic
2. Monitor metrics
3. Gradually increase to 100%
4. Roll back if issues occur

## Monitoring

### Key Metrics
- Request latency (P50, P95, P99)
- Error rates
- Queue sizes
- Memory usage
- CPU usage
- Database connection pool usage

### Alerts
- P95 latency > 150ms
- Error rate > 1%
- Queue size > 80% capacity
- Memory usage > 80%
- Database connections > 80% pool

## Rollback Plan

If optimizations cause issues:

1. **Feature Flags**: Disable via feature flags
2. **Configuration**: Revert to previous config
3. **Code Rollback**: Revert code changes
4. **Monitor**: Watch for recovery

## Resources

- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Redis Performance Tuning](https://redis.io/docs/management/optimization/)
- [OpenTelemetry Performance](https://opentelemetry.io/docs/instrumentation/js/performance/)

