/**
 * Langfuse Service
 * 
 * Service wrapper for Langfuse SDK to export traces and observability data
 * Supports:
 * - Trace export from OpenTelemetry spans
 * - Agent execution tracking
 * - Cost and performance metrics
 * - Async/batched processing for performance
 */

import { Langfuse } from 'langfuse';
import { trace, Span, SpanStatusCode } from '@opentelemetry/api';

interface LangfuseConfig {
  publicKey?: string;
  secretKey?: string;
  host?: string;
  enabled?: boolean;
}

interface TraceExportOptions {
  traceId: string;
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  input?: any;
  output?: any;
  level?: 'DEFAULT' | 'DEBUG' | 'ERROR';
  statusMessage?: string;
  startTime?: Date;
  endTime?: Date;
  cost?: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
}

interface SpanExportOptions {
  traceId: string;
  spanId: string;
  name: string;
  parentSpanId?: string;
  startTime: Date;
  endTime: Date;
  attributes?: Record<string, any>;
  events?: Array<{
    name: string;
    time: Date;
    attributes?: Record<string, any>;
  }>;
  status?: {
    code: SpanStatusCode;
    message?: string;
  };
  cost?: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
}

/**
 * Langfuse Service
 * 
 * Wraps Langfuse SDK for trace export and observability
 */
export class LangfuseService {
  private client: Langfuse | null = null;
  private enabled: boolean = false;
  private batchQueue: TraceExportOptions[] = [];
  private spanQueue: Array<{ options: SpanExportOptions; resolve: (url: string | null) => void; reject: (err: any) => void }> = [];
  private agentExecutionQueue: Array<{ options: any; resolve: (url: string | null) => void; reject: (err: any) => void }> = [];
  private batchSize: number = 10;
  private batchInterval: number = 5000; // 5 seconds
  private batchTimer: NodeJS.Timeout | null = null;
  private processingQueue: boolean = false;

  constructor(config?: LangfuseConfig) {
    const publicKey = config?.publicKey || process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = config?.secretKey || process.env.LANGFUSE_SECRET_KEY;
    const host = config?.host || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';
    this.enabled = config?.enabled !== false && !!(publicKey && secretKey);

    // Configure batch size and interval from environment or defaults
    this.batchSize = process.env.LANGFUSE_BATCH_SIZE 
      ? parseInt(process.env.LANGFUSE_BATCH_SIZE, 10) 
      : 10;
    this.batchInterval = process.env.LANGFUSE_BATCH_INTERVAL_MS
      ? parseInt(process.env.LANGFUSE_BATCH_INTERVAL_MS, 10)
      : 5000;

    if (this.enabled) {
      try {
        this.client = new Langfuse({
          publicKey,
          secretKey,
          baseUrl: host,
          flushAt: this.batchSize,
          flushInterval: this.batchInterval,
        });

        // Start batch processing timer
        this.startBatchProcessor();

        console.log('✅ Langfuse service initialized');
        console.log(`   Host: ${host}`);
        console.log(`   Batch size: ${this.batchSize}`);
        console.log(`   Batch interval: ${this.batchInterval}ms`);
      } catch (error: any) {
        console.error('❌ Failed to initialize Langfuse:', error);
        this.enabled = false;
      }
    } else {
      console.log('⚠️ Langfuse disabled (missing API keys)');
    }
  }

  /**
   * Start batch processor for async trace exports
   */
  private startBatchProcessor(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }

    this.batchTimer = setInterval(() => {
      this.flushBatch();
    }, this.batchInterval);
  }

  /**
   * Flush batch queue
   */
  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0 || !this.client) {
      return;
    }

    const batch = this.batchQueue.splice(0, this.batchSize);
    const startTime = Date.now();
    
    try {
      // Process batch in parallel for better performance
      await Promise.all(
        batch.map(trace => this.exportTraceSync(trace))
      );

      // Flush to Langfuse
      await this.client.flushAsync();
      
      const duration = Date.now() - startTime;
      if (duration > 100) {
        console.log(`[Langfuse] Processed batch of ${batch.length} traces in ${duration}ms`);
      }
    } catch (error: any) {
      console.error('[Langfuse] Batch export failed:', error);
      // Re-queue failed traces (with limit to prevent memory issues)
      if (this.batchQueue.length < 100) {
        this.batchQueue.push(...batch);
      }
    }
  }

  /**
   * Export trace to Langfuse (async/batched)
   */
  async exportTrace(options: TraceExportOptions): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    // Add to batch queue for async processing
    this.batchQueue.push(options);

    // Flush if batch is full (trigger immediate flush for better responsiveness)
    if (this.batchQueue.length >= this.batchSize) {
      // Use setImmediate to avoid blocking, but process immediately
      setImmediate(() => this.flushBatch());
    }
  }

  /**
   * Export trace synchronously (for immediate export)
   */
  private async exportTraceSync(options: TraceExportOptions): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      const trace = this.client.trace({
        id: options.traceId,
        name: options.name,
        userId: options.userId,
        sessionId: options.sessionId,
        metadata: options.metadata,
        tags: options.tags,
        input: options.input,
        output: options.output,
        level: options.level || 'DEFAULT',
        statusMessage: options.statusMessage,
        startTime: options.startTime,
        endTime: options.endTime,
      });

      // Add cost and token information if available
      if (options.cost !== undefined) {
        trace.update({
          metadata: {
            ...options.metadata,
            cost: options.cost,
            tokens: options.tokens,
          },
        });
      }

      // End trace
      trace.end({
        endTime: options.endTime,
      });
    } catch (error: any) {
      console.error('[Langfuse] Trace export failed:', error);
      throw error;
    }
  }

  /**
   * Export span to Langfuse (async, non-blocking)
   * Returns Langfuse trace URL for linking
   */
  async exportSpan(options: SpanExportOptions): Promise<string | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    // Process asynchronously using setImmediate to avoid blocking
    return new Promise<string | null>((resolve, reject) => {
      this.spanQueue.push({ options, resolve, reject });
      
      // Trigger async processing if not already processing
      if (!this.processingQueue) {
        setImmediate(() => this.processQueues());
      }
    });
  }

  /**
   * Process span queue asynchronously with batching
   */
  private async processSpanQueue(): Promise<void> {
    if (this.spanQueue.length === 0 || !this.client) {
      return;
    }

    const items = this.spanQueue.splice(0, this.batchSize);
    const startTime = Date.now();
    
    // Process items in parallel for better performance
    const promises = items.map(async (item) => {
      try {
        const generation = this.client!.generation({
          traceId: item.options.traceId,
          id: item.options.spanId,
          name: item.options.name,
          parentObservationId: item.options.parentSpanId,
          startTime: item.options.startTime,
          endTime: item.options.endTime,
          metadata: {
            ...item.options.attributes,
            cost: item.options.cost,
            tokens: item.options.tokens,
            // Add OpenTelemetry trace/span IDs for linking
            'otel.traceId': item.options.traceId,
            'otel.spanId': item.options.spanId,
          },
          level: item.options.status?.code === SpanStatusCode.ERROR ? 'ERROR' : 'DEFAULT',
          statusMessage: item.options.status?.message,
        });

        // Add events if available
        if (item.options.events && item.options.events.length > 0) {
          for (const event of item.options.events) {
            generation.event({
              name: event.name,
              time: event.time,
              metadata: event.attributes,
            });
          }
        }

        // End generation
        generation.end({
          endTime: item.options.endTime,
        });

        // Return Langfuse trace URL
        const url = this.getTraceUrl(item.options.traceId);
        item.resolve(url);
      } catch (error: any) {
        console.error('[Langfuse] Span export failed:', error);
        item.reject(error);
      }
    });

    await Promise.all(promises);

    // Flush to Langfuse after processing batch
    if (this.client) {
      try {
        await this.client.flushAsync();
        const duration = Date.now() - startTime;
        if (duration > 100) {
          console.log(`[Langfuse] Processed batch of ${items.length} spans in ${duration}ms`);
        }
      } catch (error: any) {
        console.error('[Langfuse] Flush failed:', error);
      }
    }
  }

  /**
   * Get Langfuse trace URL
   */
  getTraceUrl(traceId: string): string | null {
    if (!this.enabled || !this.client) {
      return null;
    }

    const host = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com';
    // Langfuse trace URLs follow pattern: {host}/traces/{traceId}
    return `${host}/traces/${traceId}`;
  }

  /**
   * Process agent execution queue asynchronously with batching
   */
  private async processAgentExecutionQueue(): Promise<void> {
    if (this.agentExecutionQueue.length === 0 || !this.client) {
      return;
    }

    const items = this.agentExecutionQueue.splice(0, this.batchSize);
    const startTime = Date.now();
    
    // Process items in parallel for better performance
    const promises = items.map(async (item) => {
      try {
        const url = await this.exportAgentExecutionSync(item.options);
        item.resolve(url);
      } catch (error: any) {
        console.error('[Langfuse] Agent execution export failed:', error);
        item.reject(error);
      }
    });

    await Promise.all(promises);

    // Flush to Langfuse after processing batch
    if (this.client) {
      try {
        await this.client.flushAsync();
        const duration = Date.now() - startTime;
        if (duration > 100) {
          console.log(`[Langfuse] Processed batch of ${items.length} agent executions in ${duration}ms`);
        }
      } catch (error: any) {
        console.error('[Langfuse] Flush failed:', error);
      }
    }
  }

  /**
   * Process all queues asynchronously with optimized batching
   */
  private async processQueues(): Promise<void> {
    if (this.processingQueue) {
      return; // Already processing
    }

    this.processingQueue = true;

    try {
      // Process all queues in parallel for maximum throughput
      await Promise.all([
        this.processSpanQueue(),
        this.processAgentExecutionQueue(),
        // Also process trace queue if it has items
        this.batchQueue.length >= this.batchSize ? this.flushBatch() : Promise.resolve(),
      ]);
    } catch (error: any) {
      console.error('[Langfuse] Queue processing error:', error);
    } finally {
      this.processingQueue = false;

      // Continue processing if there are more items
      // Check if queues are full enough to warrant immediate processing
      const hasEnoughItems = 
        this.spanQueue.length >= this.batchSize ||
        this.agentExecutionQueue.length >= this.batchSize ||
        this.batchQueue.length >= this.batchSize;
      
      if (hasEnoughItems) {
        // Process immediately if batch is full
        setImmediate(() => this.processQueues());
      } else if (this.spanQueue.length > 0 || this.agentExecutionQueue.length > 0 || this.batchQueue.length > 0) {
        // Otherwise, wait a bit before processing remaining items
        setTimeout(() => this.processQueues(), 100);
      }
    }
  }

  /**
   * Export agent execution trace (async, non-blocking)
   * Returns Langfuse trace URL for linking
   */
  async exportAgentExecution(options: {
    traceId: string;
    agentId: string;
    framework: string;
    query: string;
    executionId: string;
    userId?: string;
    organizationId?: string;
    workspaceId?: string;
    startTime: Date;
    endTime: Date;
    success: boolean;
    error?: string;
    cost?: number;
    tokens?: {
      prompt?: number;
      completion?: number;
      total?: number;
    };
    metadata?: Record<string, any>;
    thoughts?: Array<{
      step: number;
      thought?: string;
      action?: string;
      actionInput?: any;
      observation?: string;
      tool?: string;
      toolInput?: any;
      toolOutput?: any;
      timestamp?: Date;
    }>;
    intermediateSteps?: any[];
  }): Promise<string | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    // Process asynchronously using setImmediate to avoid blocking
    return new Promise<string | null>((resolve, reject) => {
      this.agentExecutionQueue.push({ options, resolve, reject });
      
      // Trigger async processing if not already processing
      if (!this.processingQueue) {
        setImmediate(() => this.processQueues());
      }
    });
  }

  /**
   * Export agent execution trace synchronously (internal)
   */
  private async exportAgentExecutionSync(options: {
    traceId: string;
    agentId: string;
    framework: string;
    query: string;
    executionId: string;
    userId?: string;
    organizationId?: string;
    workspaceId?: string;
    startTime: Date;
    endTime: Date;
    success: boolean;
    error?: string;
    cost?: number;
    tokens?: {
      prompt?: number;
      completion?: number;
      total?: number;
    };
    metadata?: Record<string, any>;
    thoughts?: Array<{
      step: number;
      thought?: string;
      action?: string;
      actionInput?: any;
      observation?: string;
      tool?: string;
      toolInput?: any;
      toolOutput?: any;
      timestamp?: Date;
    }>;
    intermediateSteps?: any[];
  }): Promise<string | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    // Process thoughts/intermediate steps
    const thoughts = options.thoughts || [];
    const intermediateSteps = options.intermediateSteps || [];
    
    // Convert intermediateSteps to thoughts format if needed
    if (intermediateSteps.length > 0 && thoughts.length === 0) {
      intermediateSteps.forEach((step: any, index: number) => {
        // Handle different intermediate step formats
        if (step.action && step.observation) {
          // ReAct format: { action: { tool, toolInput }, observation }
          thoughts.push({
            step: index + 1,
            action: step.action.tool || step.action.name,
            actionInput: step.action.toolInput || step.action.input,
            observation: step.observation,
            tool: step.action.tool || step.action.name,
            toolInput: step.action.toolInput || step.action.input,
            toolOutput: step.observation,
          });
        } else if (step.thought || step.reasoning) {
          // Thought/reasoning format
          thoughts.push({
            step: index + 1,
            thought: step.thought || step.reasoning,
            action: step.action,
            actionInput: step.actionInput,
            observation: step.observation,
            timestamp: step.timestamp ? new Date(step.timestamp) : undefined,
          });
        } else if (typeof step === 'string') {
          // Simple string format
          thoughts.push({
            step: index + 1,
            thought: step,
          });
        } else {
          // Generic object format
          thoughts.push({
            step: index + 1,
            ...step,
          });
        }
      });
    }

    // Export main trace
    const trace = this.client!.trace({
      id: options.traceId,
      name: `Agent Execution: ${options.framework}`,
      userId: options.userId,
      sessionId: options.executionId,
      metadata: {
        agentId: options.agentId,
        framework: options.framework,
        organizationId: options.organizationId,
        workspaceId: options.workspaceId,
        success: options.success,
        error: options.error,
        totalThoughts: thoughts.length,
        ...options.metadata,
      },
      tags: ['agent-execution', options.framework],
      input: {
        query: options.query,
      },
      output: {
        success: options.success,
        error: options.error,
      },
      level: options.success ? 'DEFAULT' : 'ERROR',
      statusMessage: options.error || (options.success ? 'Success' : 'Failed'),
      startTime: options.startTime,
      endTime: options.endTime,
    });

    // Add cost and tokens if available
    if (options.cost !== undefined || options.tokens) {
      trace.update({
        metadata: {
          ...trace.metadata,
          cost: options.cost,
          tokens: options.tokens,
        },
      });
    }

    // Export each thought as a span/observation
    if (thoughts.length > 0 && this.client) {
      for (const thought of thoughts) {
        const thoughtStartTime = thought.timestamp || options.startTime;
        const thoughtEndTime = thought.timestamp || options.endTime;

        // Create a generation (observation) for each thought
        const observation = this.client.observation({
          type: 'GENERATION',
          traceId: options.traceId,
          name: `Thought ${thought.step}${thought.action ? `: ${thought.action}` : ''}`,
          startTime: thoughtStartTime instanceof Date ? thoughtStartTime : new Date(thoughtStartTime),
          endTime: thoughtEndTime instanceof Date ? thoughtEndTime : new Date(thoughtEndTime),
          metadata: {
            step: thought.step,
            thought: thought.thought,
            action: thought.action,
            tool: thought.tool,
          },
          input: thought.actionInput || thought.toolInput,
          output: thought.observation || thought.toolOutput,
        });

        observation.end({
          endTime: thoughtEndTime instanceof Date ? thoughtEndTime : new Date(thoughtEndTime),
        });
      }
    }

    // End trace
    trace.end({
      endTime: options.endTime,
    });

    // Return Langfuse trace URL for linking
    return this.getTraceUrl(options.traceId);
  }

  /**
   * Export LLM call trace
   * Returns Langfuse trace URL for linking
   */
  async exportLLMCall(options: {
    traceId: string;
    spanId?: string;
    parentSpanId?: string;
    provider: string;
    model: string;
    prompt: string;
    response?: string;
    startTime: Date;
    endTime: Date;
    cost?: number;
    tokens?: {
      prompt?: number;
      completion?: number;
      total?: number;
    };
    error?: string;
    metadata?: Record<string, any>;
  }): Promise<string | null> {
    return await this.exportSpan({
      traceId: options.traceId,
      spanId: options.spanId || `${options.traceId}-llm`,
      parentSpanId: options.parentSpanId,
      name: `LLM Call: ${options.model} (${options.provider})`,
      startTime: options.startTime,
      endTime: options.endTime,
      attributes: {
        provider: options.provider,
        model: options.model,
        ...options.metadata,
      },
      status: {
        code: options.error ? SpanStatusCode.ERROR : SpanStatusCode.OK,
        message: options.error,
      },
      cost: options.cost,
      tokens: options.tokens,
      events: [
        {
          name: 'llm.prompt',
          time: options.startTime,
          attributes: {
            prompt: options.prompt,
          },
        },
        ...(options.response
          ? [
              {
                name: 'llm.response',
                time: options.endTime,
                attributes: {
                  response: options.response,
                },
              },
            ]
          : []),
      ],
    });
  }

  /**
   * Flush all pending exports
   */
  async flush(): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    // Flush batch queue
    await this.flushBatch();

    // Flush Langfuse client
    await this.client.flushAsync();
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Flush all pending exports
    await this.flush();

    if (this.client) {
      await this.client.shutdownAsync();
    }
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
export const langfuseService = new LangfuseService();

