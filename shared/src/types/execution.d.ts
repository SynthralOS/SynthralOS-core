export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export interface WorkflowExecution {
    id: string;
    workflowId: string;
    status: ExecutionStatus;
    startedAt: Date;
    finishedAt?: Date;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    error?: string;
    metadata?: ExecutionMetadata;
}
export interface ExecutionMetadata {
    duration?: number;
    nodesExecuted?: number;
    totalNodes?: number;
    tokensUsed?: number;
    cost?: number;
    retries?: number;
    debugState?: {
        currentNodeId?: string;
        results?: Record<string, unknown>;
        stepMode?: boolean;
        pausedAt?: Date;
    };
}
export interface ExecutionLog {
    id: string;
    executionId: string;
    nodeId: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    data?: Record<string, unknown>;
    timestamp: Date;
}
//# sourceMappingURL=execution.d.ts.map