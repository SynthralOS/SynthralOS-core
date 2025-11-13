import { WorkflowDefinition, WorkflowNode, WorkflowEdge, NodeExecutionContext } from '@sos/shared';
import { Queue, Worker } from 'bullmq';
import redis from '../config/redis';
import { executeNode } from './nodeExecutors';
import { db } from '../config/database';
import { workflowExecutions, executionLogs, executionSteps, workflows } from '../../drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { alertService } from './alertService';
import { websocketService } from './websocketService';
import { posthogService } from './posthogService';
import { createId } from '@paralleldrive/cuid2';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

export class WorkflowExecutor {
  private queue: Queue;
  private worker: Worker;

  constructor() {
    this.queue = new Queue('workflow-execution', {
      connection: redis,
    });

    this.worker = new Worker(
      'workflow-execution',
      async (job) => {
        return this.executeWorkflow(job.data);
      },
      {
        connection: redis,
        concurrency: 10,
      }
    );
  }

  async executeWorkflow(data: {
    workflowId: string;
    definition: WorkflowDefinition;
    input?: Record<string, unknown>;
    executionId?: string;
    stepMode?: boolean;
    userId?: string;
    organizationId?: string;
    workspaceId?: string;
  }): Promise<unknown> {
    const { definition, input = {}, executionId: providedExecutionId } = data;

    // Get workspaceId from workflow if not provided
    let workspaceId = data.workspaceId;
    if (!workspaceId) {
      try {
        const [workflow] = await db
          .select({ workspaceId: workflows.workspaceId })
          .from(workflows)
          .where(eq(workflows.id, data.workflowId))
          .limit(1);
        workspaceId = workflow?.workspaceId;
      } catch (err) {
        console.warn('[WorkflowExecutor] Could not fetch workspaceId:', err);
      }
    }

    // Create execution record
    const [execution] = await db
      .insert(workflowExecutions)
      .values({
        workflowId: data.workflowId,
        status: 'running',
        input: input as any,
        metadata: {
          ...(data.stepMode ? {
            debugState: {
              stepMode: true,
            },
          } : {}),
          ...(data.userId ? { userId: data.userId } : {}),
          ...(data.organizationId ? { organizationId: data.organizationId } : {}),
          ...(workspaceId ? { workspaceId } : {}),
        },
      })
      .returning();

    const executionId = providedExecutionId || execution.id;

    // Create OpenTelemetry trace for workflow execution
    const tracer = trace.getTracer('sos-workflow-executor');
    const span = tracer.startSpan('workflow.execute', {
      attributes: {
        'workflow.id': data.workflowId,
        'workflow.execution_id': executionId,
        'workflow.step_mode': data.stepMode || false,
        'workflow.node_count': definition.nodes.length,
        'workflow.edge_count': definition.edges.length,
        'user.id': data.userId || '',
        'organization.id': data.organizationId || '',
        'workspace.id': workspaceId || '',
      },
    });

    // Emit execution start event
    websocketService.emitExecutionStart(executionId, data.workflowId, input);

    const startTime = Date.now();
    let traceId: string | undefined;

    try {
      // Get trace ID from current span context
      const spanContext = span.spanContext();
      traceId = spanContext.traceId;
      // Build execution graph
      const nodes = new Map<string, WorkflowNode>();
      const edges = new Map<string, WorkflowEdge[]>();

      definition.nodes.forEach((node) => {
        nodes.set(node.id, node);
        edges.set(node.id, []);
      });

      definition.edges.forEach((edge) => {
        const sourceEdges = edges.get(edge.source) || [];
        sourceEdges.push(edge);
        edges.set(edge.source, sourceEdges);
      });

      // Find start nodes (nodes with no incoming edges or trigger nodes)
      const startNodes = definition.nodes.filter(
        (node) =>
          !definition.edges.some((edge) => edge.target === node.id) ||
          (node.data?.type as string)?.startsWith('trigger.')
      );

      // Execute workflow
      const results: Record<string, unknown> = {};

      // Handle empty workflow
      if (startNodes.length === 0 && definition.nodes.length > 0) {
        // All nodes have incoming edges - find nodes with no incoming edges (shouldn't happen, but handle it)
        const nodesWithNoIncoming = definition.nodes.filter(
          (node) => !definition.edges.some((edge) => edge.target === node.id)
        );
        
        if (nodesWithNoIncoming.length === 0) {
          // Circular dependency or all nodes connected - execute first node
          if (definition.nodes.length > 0) {
            startNodes.push(definition.nodes[0]);
          }
        } else {
          startNodes.push(...nodesWithNoIncoming);
        }
      }

      // Execute start nodes in parallel if there are multiple
      if (startNodes.length > 1) {
        const startNodeExecutions = startNodes.map((startNode) =>
          this.executeNode(startNode, input, results, nodes, edges, executionId, data.workflowId)
        );
        await Promise.all(startNodeExecutions);
      } else if (startNodes.length === 1) {
        await this.executeNode(startNodes[0], input, results, nodes, edges, executionId, data.workflowId);
      }

      // Update execution status
      await db
        .update(workflowExecutions)
        .set({
          status: 'completed',
          finishedAt: new Date(),
          output: results as any,
        })
        .where(eq(workflowExecutions.id, executionId));

      // Emit execution complete event
      websocketService.emitExecutionComplete(executionId, results);

      // Track workflow execution in PostHog
      if (data.userId && data.organizationId) {
        // Collect tools used from node types
        const toolsUsed = definition.nodes
          .map((node) => {
            const nodeType = (node.data?.type as string) || '';
            if (nodeType.startsWith('integration.')) {
              return nodeType.replace('integration.', '');
            }
            if (nodeType.startsWith('tool.')) {
              return nodeType.replace('tool.', '');
            }
            return nodeType;
          })
          .filter((tool) => tool && tool !== 'trigger' && tool !== 'logic');

        const latencyMs = Date.now() - startTime;
        posthogService.trackFlowExecuted({
          userId: data.userId,
          organizationId: data.organizationId,
          workspaceId: workspaceId || undefined,
          flowId: data.workflowId,
          executionId,
          toolsUsed,
          timeMs: latencyMs,
          success: true,
          traceId,
        });
      }

      // Check alerts after completion
      try {
        await alertService.checkAlerts(executionId);
      } catch (alertError) {
        console.error('Error checking alerts:', alertError);
        // Don't fail execution if alert check fails
      }

      return {
        executionId,
        status: 'completed',
        results,
      };
    } catch (error: any) {
      // Update execution status to failed
      await db
        .update(workflowExecutions)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          error: error.message,
        })
        .where(eq(workflowExecutions.id, executionId));

      // Emit execution error event
      websocketService.emitNodeError(executionId, 'workflow', error);

      // Track workflow execution failure in PostHog
      if (data.userId && data.organizationId) {
        const toolsUsed = definition.nodes
          .map((node) => {
            const nodeType = (node.data?.type as string) || '';
            if (nodeType.startsWith('integration.')) {
              return nodeType.replace('integration.', '');
            }
            if (nodeType.startsWith('tool.')) {
              return nodeType.replace('tool.', '');
            }
            return nodeType;
          })
          .filter((tool) => tool && tool !== 'trigger' && tool !== 'logic');

        const latencyMs = Date.now() - startTime;
        posthogService.trackFlowExecuted({
          userId: data.userId,
          organizationId: data.organizationId,
          workspaceId: workspaceId || undefined,
          flowId: data.workflowId,
          executionId,
          toolsUsed,
          timeMs: latencyMs,
          success: false,
          traceId,
        });
      }

      // Check alerts after failure
      try {
        await alertService.checkAlerts(executionId);
      } catch (alertError) {
        console.error('Error checking alerts:', alertError);
        // Don't fail execution if alert check fails
      }

      // Return execution info even on failure so frontend can monitor it
      return {
        executionId,
        status: 'failed',
        error: error.message,
        results: {},
        traceId, // Include trace ID in response
      };
    }
  }

  private async executeNode(
    node: WorkflowNode,
    input: Record<string, unknown>,
    results: Record<string, unknown>,
    nodes: Map<string, WorkflowNode>,
    edges: Map<string, WorkflowEdge[]>,
    executionId: string,
    workflowId: string,
    stepMode: boolean = false,
    parentStepId?: string
  ): Promise<unknown> {
    const nodeType = (node.data?.type as string) || node.type;
    console.log(`Executing node ${node.id} of type ${nodeType}`);

    // Get next step number
    const existingSteps = await db
      .select()
      .from(executionSteps)
      .where(eq(executionSteps.executionId, executionId))
      .orderBy(desc(executionSteps.stepNumber))
      .limit(1);
    
    const stepNumber = existingSteps.length > 0 ? (existingSteps[0].stepNumber || 0) + 1 : 1;

    // Create execution step record
    const stepId = createId();
    const stepStartTime = Date.now();
    
    await db.insert(executionSteps).values({
      id: stepId,
      executionId,
      nodeId: node.id,
      stepNumber,
      status: 'running',
      input: { ...input, ...this.collectPreviousOutputs(node, edges, results) },
      startedAt: new Date(),
      parentStepId: parentStepId || null,
    });

    // Emit node start event
    websocketService.emitNodeStart(executionId, node.id, input);

    // Check for breakpoint or step mode
    const hasBreakpoint = (node.data?.breakpoint as boolean) || false;
    const execution = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, executionId)).limit(1);
    const executionData = execution[0];
    const metadata = (executionData?.metadata as any) || {};
    const isStepMode = metadata.debugState?.stepMode || stepMode;

    if (hasBreakpoint || isStepMode) {
      // Pause execution at breakpoint or in step mode
      await db.update(workflowExecutions).set({
        status: 'paused',
        metadata: {
          ...((execution[0]?.metadata as any) || {}),
          debugState: {
            currentNodeId: node.id,
            results: results,
            stepMode: isStepMode,
            pausedAt: new Date(),
          },
        },
      }).where(eq(workflowExecutions.id, executionId));

      // Emit execution paused event
      websocketService.emitExecutionPaused(executionId, node.id);

      // Log breakpoint hit
      await db.insert(executionLogs).values({
        executionId,
        nodeId: node.id,
        level: 'debug',
        message: hasBreakpoint ? `Breakpoint hit at node ${node.id}` : `Paused at node ${node.id} (step mode)`,
        data: { breakpoint: hasBreakpoint, stepMode: isStepMode },
      });

      // Wait for resume signal using Redis pub/sub
      await this.waitForResume(executionId);
    }

    // For merge nodes, check if all inputs are ready before executing
    if (nodeType === 'logic.merge') {
      const incomingEdges = Array.from(edges.values())
        .flat()
        .filter((edge) => edge.target === node.id);
      
      const allInputsReady = incomingEdges.length > 0 && incomingEdges.every((edge) => {
        const sourceResult = results[edge.source];
        return sourceResult !== undefined;
      });

      // If not all inputs are ready, don't execute yet - return early
      // The merge node will be executed when the last input arrives
      if (!allInputsReady) {
        console.log(`Merge node ${node.id} waiting for all inputs (${incomingEdges.filter(e => results[e.source] !== undefined).length}/${incomingEdges.length} ready)`);
        return {
          nodeId: node.id,
          success: true,
          output: {},
          waiting: true,
        };
      }
    }

    // Collect previous outputs for data flow
    const previousOutputs = this.collectPreviousOutputs(node, edges, results);

    // Prepare node execution context
    const nodeConfig = (node.data?.config as Record<string, unknown>) || {};
    
    // Get retry configuration (node-level or workflow-level)
    const nodeRetry = (node.data?.retry as any) || (node.data?.workflowSettings?.retry as any);
    const retryConfig = nodeRetry || (node.data?.workflowSettings?.retry as any);
    const maxAttempts = retryConfig?.enabled ? (retryConfig.maxAttempts || 3) : 1;
    const backoffType = retryConfig?.backoff || 'exponential';
    const baseDelay = retryConfig?.delay || 1000;

    // Execute the node with retry logic
    let executionResult;
    let attempt = 0;
    let lastError: any = null;

    // Create OpenTelemetry span for node execution
    const tracer = trace.getTracer('sos-node-executor');
    const nodeSpan = tracer.startSpan(`node.execute.${nodeType}`, {
      attributes: {
        'node.id': node.id,
        'node.type': nodeType,
        'workflow.id': workflowId,
        'workflow.execution_id': executionId,
        'node.retry.max_attempts': maxAttempts,
      },
    });

    const nodeStartTime = Date.now();

    while (attempt < maxAttempts) {
      attempt++;
      
      // Get userId, organizationId, and workspaceId from execution metadata
      const execution = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, executionId)).limit(1);
      const executionData = execution[0];
      const metadata = (executionData?.metadata as any) || {};
      const userId = metadata.userId || '';
      const organizationId = metadata.organizationId || '';
      const workspaceId = metadata.workspaceId || '';

      const context: NodeExecutionContext & { userId?: string; organizationId?: string; workspaceId?: string } = {
        nodeId: node.id,
        workflowId,
        executionId,
        input: { ...input, ...previousOutputs },
        previousOutputs,
        config: {
          type: nodeType,
          ...nodeConfig,
        },
        userId,
        organizationId,
        workspaceId,
      };

      nodeSpan.setAttributes({
        'node.attempt': attempt,
        'user.id': userId || '',
        'organization.id': organizationId || '',
        'workspace.id': workspaceId || '',
      });

      try {
        executionResult = await executeNode(context);

        // If successful, break out of retry loop
        if (executionResult.success) {
          if (attempt > 1) {
          // Log successful retry
          await db.insert(executionLogs).values({
            executionId,
            nodeId: node.id,
            level: 'info',
            message: `Node ${node.id} succeeded after ${attempt} attempt(s)`,
            data: { attempts: attempt, retryAttempt: attempt - 1 },
          });
          }
          break;
        }

        // Store last error
        lastError = executionResult.error;
      } catch (nodeError: any) {
        // Handle unexpected errors during node execution
        executionResult = {
          success: false,
          error: {
            message: nodeError.message || 'Unexpected error during node execution',
            code: 'NODE_EXECUTION_ERROR',
            details: nodeError,
          },
        };
        lastError = executionResult.error;
      }

      // Log retry attempt
      if (attempt < maxAttempts) {
        await db.insert(executionLogs).values({
          executionId,
          nodeId: node.id,
          level: 'warn',
          message: `Node ${node.id} failed, retrying (attempt ${attempt}/${maxAttempts})`,
          data: { 
            error: executionResult.error,
            attempt,
            maxAttempts,
          },
        });

        // Calculate delay based on backoff type
        let delay: number;
        if (backoffType === 'exponential') {
          // Exponential backoff: delay * 2^(attempt - 1)
          delay = baseDelay * Math.pow(2, attempt - 1);
        } else {
          // Fixed backoff
          delay = baseDelay;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const executionTime = Date.now() - nodeStartTime;

    // Update span with node execution result
    if (executionResult.success) {
      nodeSpan.setAttributes({
        'node.status': 'completed',
        'node.latency_ms': executionTime,
        'node.attempts': attempt,
      });
      nodeSpan.setStatus({ code: SpanStatusCode.OK });
    } else {
      nodeSpan.setAttributes({
        'node.status': 'failed',
        'node.latency_ms': executionTime,
        'node.attempts': attempt,
        'node.error': executionResult.error?.message || 'Unknown error',
        'node.error_code': executionResult.error?.code || 'UNKNOWN',
      });
      if (lastError) {
        nodeSpan.recordException(new Error(lastError.message || 'Node execution failed'));
      }
      nodeSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: executionResult.error?.message || 'Node execution failed',
      });
    }
    nodeSpan.end();

    // Track tool usage in PostHog
    const executionRecord = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, executionId)).limit(1);
    const executionRecordData = executionRecord[0];
    const executionMetadata = (executionRecordData?.metadata as any) || {};
    const userId = executionMetadata.userId || '';
    const organizationId = executionMetadata.organizationId || '';
    const workspaceId = executionMetadata.workspaceId || '';

    if (userId && organizationId) {
      // Get trace ID from span context
      const spanContext = nodeSpan.spanContext();
      const nodeTraceId = spanContext.traceId;

      posthogService.trackToolUsed({
        userId,
        organizationId,
        workspaceId: workspaceId || undefined,
        toolId: node.id,
        toolType: nodeType,
        status: executionResult.success ? 'success' : 'error',
        latencyMs: executionTime,
        executionId,
        traceId: nodeTraceId,
      });
    }

    // Update execution step with result
    await db.update(executionSteps).set({
      status: executionResult.success ? 'completed' : 'failed',
      output: executionResult.output || null,
      error: executionResult.error || null,
      finishedAt: new Date(),
      executionTime,
      retryAttempt: attempt - 1,
    }).where(eq(executionSteps.id, stepId));

    // If all retries failed, use the last error
    if (!executionResult.success && attempt >= maxAttempts) {
      await db.insert(executionLogs).values({
        executionId,
        nodeId: node.id,
        level: 'error',
        message: `Node ${node.id} failed after ${maxAttempts} attempt(s)`,
        data: { 
          error: lastError,
          attempts: maxAttempts,
        },
      });
    } else if (executionResult.success && attempt === 1) {
      // Log successful execution (only if no retries were needed)
      await db.insert(executionLogs).values({
        executionId,
        nodeId: node.id,
        level: 'info',
        message: `Node ${node.id} executed successfully`,
        data: executionResult.output || {},
      });
    }

    // Store result
    const result = {
      nodeId: node.id,
      success: executionResult.success,
      output: executionResult.output || {},
      error: executionResult.error,
    };

    results[node.id] = result;

    // Emit node complete or error event
    if (executionResult.success) {
      websocketService.emitNodeComplete(executionId, node.id, executionResult.output);
    } else {
      websocketService.emitNodeError(executionId, node.id, executionResult.error);
    }

    // Store variable snapshot for debugging
    const variableSnapshot = {
      nodeId: node.id,
      timestamp: new Date(),
      input: input,
      output: executionResult.output || {},
      previousOutputs: previousOutputs,
      allResults: { ...results },
    };

    // Store snapshot in execution metadata
    const executionRecordForSnapshot = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, executionId)).limit(1);
    if (executionRecordForSnapshot[0]) {
      const metadata = (executionRecordForSnapshot[0].metadata as any) || {};
      if (!metadata.variableSnapshots) {
        metadata.variableSnapshots = {};
      }
      metadata.variableSnapshots[node.id] = variableSnapshot;
      
      await db.update(workflowExecutions).set({
        metadata: metadata,
      }).where(eq(workflowExecutions.id, executionId));
    }

    // After storing result, check if any waiting merge nodes can now execute
    // Find all merge nodes that have this node as an input
    const mergeNodesWaiting = Array.from(nodes.values()).filter((n) => {
      const nType = (n.data?.type as string) || n.type;
      if (nType !== 'logic.merge') return false;
      const incomingEdges = Array.from(edges.values())
        .flat()
        .filter((edge) => edge.target === n.id);
      return incomingEdges.some((edge) => edge.source === node.id);
    });

    // Try to execute waiting merge nodes
    for (const mergeNode of mergeNodesWaiting) {
      const incomingEdges = Array.from(edges.values())
        .flat()
        .filter((edge) => edge.target === mergeNode.id);
      const allInputsReady = incomingEdges.every((edge) => {
        const sourceResult = results[edge.source];
        return sourceResult !== undefined && !(sourceResult as any).waiting;
      });

      if (allInputsReady) {
        // Execute the merge node now that all inputs are ready
        await this.executeNode(
          mergeNode,
          input,
          results,
          nodes,
          edges,
          executionId,
          workflowId
        );
      }
    }

    // Handle error path routing
    if (!executionResult.success) {
      const nodeEdges = edges.get(node.id) || [];
      
      // Look for error output handle (sourceHandle === 'error')
      const errorEdges = nodeEdges.filter((edge) => {
        const sourceHandle = (edge as any).sourceHandle;
        return sourceHandle === 'error';
      });

      if (errorEdges.length > 0) {
        // Route to error handling nodes
        const errorOutput = {
          error: executionResult.error,
          originalInput: input,
          failedNodeId: node.id,
        };

        // Execute error handling nodes in parallel
        const errorNodeExecutions = errorEdges.map((edge) => {
          const targetNode = nodes.get(edge.target);
          if (targetNode) {
            return this.executeNode(
              targetNode,
              errorOutput as Record<string, unknown>,
              results,
              nodes,
              edges,
              executionId,
              workflowId
            );
          }
          return Promise.resolve();
        });

        await Promise.all(errorNodeExecutions);
        return result; // Don't continue with normal flow after error routing
      }
      
      // No error path - check if workflow settings allow continuing on error
      const workflowSettings = (node.data?.workflowSettings as any) || {};
      if (!workflowSettings.errorHandling?.continueOnError) {
        // Stop execution if no error path and continueOnError is false
        return result;
      }
    }

    // Execute connected nodes if successful
    if (executionResult.success) {
      const nodeEdges = edges.get(node.id) || [];

      // Handle conditional branching (IF/ELSE)
      if (nodeType === 'logic.if') {
        const condition = (executionResult.output as any)?.condition;
        // Find edge with matching sourceHandle (true/false)
        const matchingEdge = nodeEdges.find((edge) => {
          const sourceHandle = (edge as any).sourceHandle;
          if (condition && sourceHandle === 'true') return true;
          if (!condition && sourceHandle === 'false') return true;
          return false;
        });

        if (matchingEdge) {
          const targetNode = nodes.get(matchingEdge.target);
          if (targetNode) {
            await this.executeNode(
              targetNode,
              executionResult.output as Record<string, unknown>,
              results,
              nodes,
              edges,
              executionId,
              workflowId
            );
          }
        }
      }
      // Handle Switch node
      else if (nodeType === 'logic.switch') {
        const matchedCase = (executionResult.output as any)?.case;
        // Find edge with matching sourceHandle (case name)
        const matchingEdge = nodeEdges.find((edge) => {
          const sourceHandle = (edge as any).sourceHandle;
          return sourceHandle === matchedCase || sourceHandle === 'default';
        });

        if (matchingEdge) {
          const targetNode = nodes.get(matchingEdge.target);
          if (targetNode) {
            await this.executeNode(
              targetNode,
              executionResult.output as Record<string, unknown>,
              results,
              nodes,
              edges,
              executionId,
              workflowId
            );
          }
        }
      }
      // Handle Merge node - wait for all inputs before proceeding
      else if (nodeType === 'logic.merge') {
        // Check if all incoming edges have completed
        const incomingEdgesForMerge = Array.from(edges.values())
          .flat()
          .filter((edge) => edge.target === node.id);
        
        const allInputsReady = incomingEdgesForMerge.every((edge) => {
          const sourceResult = results[edge.source];
          return sourceResult !== undefined;
        });

        // Only execute merge node's outgoing edges if all inputs are ready
        if (allInputsReady) {
          // Merge node executor already collected all inputs
          // Execute outgoing edges after merge completes
          for (const edge of nodeEdges) {
            const targetNode = nodes.get(edge.target);
            if (targetNode) {
              await this.executeNode(
                targetNode,
                executionResult.output as Record<string, unknown>,
                results,
                nodes,
                edges,
                executionId,
                workflowId
              );
            }
          }
        }
        // If not all inputs ready, merge node will be executed when the last input arrives
      }
      // Handle loops - will be implemented separately
      else if (nodeType.startsWith('logic.loop.')) {
        // Loop handling will be implemented in a separate method
        await this.executeLoopNode(
          node,
          executionResult,
          nodeEdges,
          nodes,
          edges,
          results,
          executionId,
          workflowId
        );
      }
      // Default: execute all connected nodes in parallel (if they can run in parallel)
      else {
        // Check if any target nodes are merge nodes - if so, we need to handle them specially
        const targetNodes = nodeEdges
          .map((edge) => {
            const targetNode = nodes.get(edge.target);
            return targetNode ? { node: targetNode, edge } : null;
          })
          .filter((item): item is { node: WorkflowNode; edge: WorkflowEdge } => item !== null);

        // Separate merge nodes from regular nodes
        const mergeNodes: Array<{ node: WorkflowNode; edge: WorkflowEdge }> = [];
        const regularNodes: Array<{ node: WorkflowNode; edge: WorkflowEdge }> = [];

        for (const { node, edge } of targetNodes) {
          const targetNodeType = (node.data?.type as string) || node.type;
          if (targetNodeType === 'logic.merge') {
            mergeNodes.push({ node, edge });
          } else {
            regularNodes.push({ node, edge });
          }
        }

        // Execute regular nodes in parallel
        if (regularNodes.length > 0) {
          const parallelExecutions = regularNodes.map(({ node, edge }) =>
            this.executeNode(
              node,
              executionResult.output as Record<string, unknown>,
              results,
              nodes,
              edges,
              executionId,
              workflowId
            )
          );
          await Promise.all(parallelExecutions);
        }

        // Execute merge nodes sequentially (they need to check if all inputs are ready)
        for (const { node, edge } of mergeNodes) {
          await this.executeNode(
            node,
            executionResult.output as Record<string, unknown>,
            results,
            nodes,
            edges,
            executionId,
            workflowId
          );
        }
      }
    }

    return result;
  }

  private async executeLoopNode(
    node: WorkflowNode,
    executionResult: any,
    nodeEdges: WorkflowEdge[],
    nodes: Map<string, WorkflowNode>,
    edges: Map<string, WorkflowEdge[]>,
    results: Record<string, unknown>,
    executionId: string,
    workflowId: string
  ): Promise<void> {
    const nodeType = (node.data?.type as string) || node.type;
    const nodeConfig = (node.data?.config as Record<string, unknown>) || {};
    const loopOutputs: unknown[] = [];

    // Find the loop body node (first connected node)
    const loopBodyEdge = nodeEdges.find((edge) => {
      // Find edge that goes back to loop or to loop body
      const targetNode = nodes.get(edge.target);
      return targetNode && targetNode.id !== node.id;
    });

    if (!loopBodyEdge) {
      return; // No loop body to execute
    }

    const loopBodyNode = nodes.get(loopBodyEdge.target);
    if (!loopBodyNode) {
      return;
    }

    // Execute based on loop type
    if (nodeType === 'logic.loop.for') {
      const count = (nodeConfig.count as number) || 10;
      const startIndex = (nodeConfig.startIndex as number) || 0;

      for (let i = startIndex; i < startIndex + count; i++) {
        const iterationInput = {
          ...executionResult.output,
          index: i,
          item: i,
        };

        // Execute loop body
        const bodyResult = await this.executeNode(
          loopBodyNode,
          iterationInput as Record<string, unknown>,
          results,
          nodes,
          edges,
          executionId,
          workflowId
        );

        if (bodyResult && typeof bodyResult === 'object' && 'output' in bodyResult) {
          loopOutputs.push((bodyResult as any).output);
        }
      }
    } else if (nodeType === 'logic.loop.foreach') {
      const arrayPath = (nodeConfig.arrayPath as string) || 'input';
      const input = executionResult.output as any;
      
      // Get array from input
      let array: unknown[] = [];
      if (arrayPath === 'input' || arrayPath === '') {
        array = Array.isArray(input?.data) ? input.data : Array.isArray(input) ? input : [];
      } else {
        // Navigate path (simple implementation)
        const parts = arrayPath.split('.');
        let value: any = input;
        for (const part of parts) {
          value = value?.[part];
        }
        array = Array.isArray(value) ? value : [];
      }

      for (let i = 0; i < array.length; i++) {
        const item = array[i];
        const iterationInput = {
          ...executionResult.output,
          index: i,
          item: item,
        };

        // Execute loop body
        const bodyResult = await this.executeNode(
          loopBodyNode,
          iterationInput as Record<string, unknown>,
          results,
          nodes,
          edges,
          executionId,
          workflowId
        );

        if (bodyResult && typeof bodyResult === 'object' && 'output' in bodyResult) {
          loopOutputs.push((bodyResult as any).output);
        }
      }
    } else if (nodeType === 'logic.loop.while') {
      const condition = (nodeConfig.condition as string) || 'true';
      const maxIterations = (nodeConfig.maxIterations as number) || 1000;
      const { VM } = require('vm2');

      let iteration = 0;
      let shouldContinue = true;

      while (shouldContinue && iteration < maxIterations) {
        // Evaluate condition
        try {
          const vm = new VM({
            timeout: 1000,
            sandbox: {
              input: executionResult.output,
              iteration,
            },
          });
          shouldContinue = vm.run(`Boolean(${condition})`);
        } catch {
          shouldContinue = false;
        }

        if (!shouldContinue) break;

        const iterationInput = {
          ...executionResult.output,
          iteration,
        };

        // Execute loop body
        const bodyResult = await this.executeNode(
          loopBodyNode,
          iterationInput as Record<string, unknown>,
          results,
          nodes,
          edges,
          executionId,
          workflowId
        );

        if (bodyResult && typeof bodyResult === 'object' && 'output' in bodyResult) {
          loopOutputs.push((bodyResult as any).output);
        }

        iteration++;
      }
    }

    // Store loop results
    results[`${node.id}_loop_output`] = {
      nodeId: node.id,
      success: true,
      output: {
        output: loopOutputs,
        count: loopOutputs.length,
      },
    };

    // Execute nodes after loop (find edges that don't go to loop body)
    const postLoopEdges = nodeEdges.filter((edge) => edge.target !== loopBodyNode.id);
    for (const edge of postLoopEdges) {
      const targetNode = nodes.get(edge.target);
      if (targetNode) {
        await this.executeNode(
          targetNode,
          { output: loopOutputs, count: loopOutputs.length } as Record<string, unknown>,
          results,
          nodes,
          edges,
          executionId,
          workflowId
        );
      }
    }
  }

  async enqueueExecution(data: {
    workflowId: string;
    definition: WorkflowDefinition;
    input?: Record<string, unknown>;
  }): Promise<string> {
    const job = await this.queue.add('execute', data);
    return job.id!;
  }

  /**
   * Wait for resume signal using Redis pub/sub
   */
  private async waitForResume(executionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const subscriber = redis.duplicate();
      const channel = `execution:${executionId}:resume`;
      
      subscriber.subscribe(channel);
      
      const timeout = setTimeout(() => {
        subscriber.unsubscribe();
        subscriber.quit();
        reject(new Error('Resume timeout (1 hour)'));
      }, 3600000); // 1 hour timeout
      
      subscriber.on('message', (ch, message) => {
        if (ch === channel) {
          clearTimeout(timeout);
          subscriber.unsubscribe();
          subscriber.quit();
          
          if (message === 'resume') {
            websocketService.emitExecutionResumed(executionId);
            resolve();
          } else if (message === 'cancel') {
            reject(new Error('Execution cancelled'));
          }
        }
      });
      
      subscriber.on('error', (error) => {
        clearTimeout(timeout);
        subscriber.unsubscribe();
        subscriber.quit();
        reject(error);
      });
    });
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(
    executionId: string,
    modifications?: {
      nodeId: string;
      input?: Record<string, unknown>;
    }
  ): Promise<void> {
    const execution = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, executionId)).limit(1);
    if (!execution[0] || execution[0].status !== 'paused') {
      throw new Error('Execution is not paused');
    }

    // Store modifications in metadata if provided
    if (modifications) {
      const metadata = (execution[0].metadata as any) || {};
      if (!metadata.resumeModifications) {
        metadata.resumeModifications = [];
      }
      metadata.resumeModifications.push(modifications);
      
      await db.update(workflowExecutions).set({
        status: 'running',
        metadata: metadata,
      }).where(eq(workflowExecutions.id, executionId));
    } else {
      await db.update(workflowExecutions).set({
        status: 'running',
      }).where(eq(workflowExecutions.id, executionId));
    }

    // Publish resume signal via Redis
    await redis.publish(`execution:${executionId}:resume`, 'resume');

    // Emit execution resumed event
    websocketService.emitExecutionResumed(executionId);
  }

  /**
   * Step to next node in a paused execution (step mode)
   */
  async stepExecution(executionId: string): Promise<void> {
    const execution = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, executionId)).limit(1);
    if (!execution[0] || execution[0].status !== 'paused') {
      throw new Error('Execution is not paused');
    }

    const metadata = (execution[0].metadata as any) || {};
    if (!metadata.debugState?.stepMode) {
      throw new Error('Execution is not in step mode');
    }

    // Resume execution (it will pause again at next node)
    await db.update(workflowExecutions).set({
      status: 'running',
    }).where(eq(workflowExecutions.id, executionId));
  }

  /**
   * Collect previous outputs for a node from connected edges
   */
  private collectPreviousOutputs(
    node: WorkflowNode,
    edges: Map<string, WorkflowEdge[]>,
    results: Record<string, unknown>
  ): Record<string, unknown> {
    const previousOutputs: Record<string, unknown> = {};
    const incomingEdges = Array.from(edges.values())
      .flat()
      .filter((edge) => edge.target === node.id);

    for (const edge of incomingEdges) {
      const sourceResult = results[edge.source] as any;
      if (sourceResult?.output) {
        Object.assign(previousOutputs, sourceResult.output);
      }
    }

    return previousOutputs;
  }
}

export const workflowExecutor = new WorkflowExecutor();

