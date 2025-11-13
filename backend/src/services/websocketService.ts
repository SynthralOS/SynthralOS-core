import { Server as SocketIOServer } from 'socket.io';

export interface ExecutionEvent {
  type: 'node_start' | 'node_complete' | 'node_error' | 'execution_start' | 'execution_complete' | 'execution_paused' | 'execution_resumed';
  executionId: string;
  nodeId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

class WebSocketService {
  private io: SocketIOServer | null = null;

  /**
   * Initialize the WebSocket service with the Socket.IO instance
   */
  initialize(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Emit execution event to all clients subscribed to this execution
   */
  emitExecutionEvent(executionId: string, event: Omit<ExecutionEvent, 'executionId' | 'timestamp'>) {
    if (!this.io) {
      console.warn('WebSocket service not initialized, skipping event emission');
      return;
    }

    const fullEvent: ExecutionEvent = {
      ...event,
      executionId,
      timestamp: new Date(),
    };

    // Emit to room for this execution
    this.io.to(`execution:${executionId}`).emit('execution:event', fullEvent);
    
    // Also emit to workflow room if needed
    // This allows clients to listen to all executions for a workflow
    // this.io.to(`workflow:${workflowId}`).emit('execution:event', fullEvent);
  }

  /**
   * Emit node start event
   */
  emitNodeStart(executionId: string, nodeId: string, input?: Record<string, unknown>) {
    this.emitExecutionEvent(executionId, {
      type: 'node_start',
      nodeId,
      data: { input },
    });
  }

  /**
   * Emit node complete event
   */
  emitNodeComplete(executionId: string, nodeId: string, output?: Record<string, unknown>) {
    this.emitExecutionEvent(executionId, {
      type: 'node_complete',
      nodeId,
      data: { output },
    });
  }

  /**
   * Emit node error event
   */
  emitNodeError(executionId: string, nodeId: string, error?: unknown) {
    this.emitExecutionEvent(executionId, {
      type: 'node_error',
      nodeId,
      data: { error },
    });
  }

  /**
   * Emit execution start event
   */
  emitExecutionStart(executionId: string, workflowId: string, input?: Record<string, unknown>) {
    this.emitExecutionEvent(executionId, {
      type: 'execution_start',
      data: { workflowId, input },
    });
  }

  /**
   * Emit execution complete event
   */
  emitExecutionComplete(executionId: string, output?: Record<string, unknown>) {
    this.emitExecutionEvent(executionId, {
      type: 'execution_complete',
      data: { output },
    });
  }

  /**
   * Emit execution paused event
   */
  emitExecutionPaused(executionId: string, nodeId?: string) {
    this.emitExecutionEvent(executionId, {
      type: 'execution_paused',
      nodeId,
    });
  }

  /**
   * Emit execution resumed event
   */
  emitExecutionResumed(executionId: string) {
    this.emitExecutionEvent(executionId, {
      type: 'execution_resumed',
    });
  }

  /**
   * Emit human prompt event
   */
  emitHumanPrompt(
    executionId: string,
    data: {
      nodeId: string;
      prompt: string;
      inputSchema?: Record<string, unknown>;
    }
  ) {
    if (!this.io) {
      console.warn('WebSocket service not initialized, skipping human prompt event');
      return;
    }

    this.io.to(`execution:${executionId}`).emit('execution:human-prompt', {
      executionId,
      nodeId: data.nodeId,
      prompt: data.prompt,
      inputSchema: data.inputSchema,
      timestamp: new Date(),
    });
  }

  // Agent execution events
  emitAgentExecutionStart(executionId: string, query: string, agentId?: string, framework?: string): void {
    if (!this.io) return;
    this.io.emit('agent:execution:start', {
      executionId,
      query,
      agentId,
      framework,
    });
  }

  emitAgentExecutionUpdate(executionId: string, chunk: string, metadata?: Record<string, unknown>): void {
    if (!this.io) return;
    this.io.emit('agent:execution:update', {
      executionId,
      chunk,
      metadata,
    });
  }

  emitAgentExecutionComplete(executionId: string, output: string, metadata?: Record<string, unknown>): void {
    if (!this.io) return;
    this.io.emit('agent:execution:complete', {
      executionId,
      output,
      metadata,
    });
  }

  emitAgentExecutionError(executionId: string, error: string): void {
    if (!this.io) return;
    this.io.emit('agent:execution:error', {
      executionId,
      error,
    });
  }
}

export const websocketService = new WebSocketService();

