export type NodeType =
  | 'trigger'
  | 'action'
  | 'ai'
  | 'code'
  | 'data'
  | 'logic'
  | 'integration';

export interface NodeDefinition {
  type: string;
  name: string;
  description?: string;
  category: NodeType;
  icon?: string;
  inputs: NodeInput[];
  outputs: NodeOutput[];
  config?: NodeConfigSchema;
}

export interface NodeInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  required?: boolean;
  description?: string;
  default?: unknown;
}

export interface NodeOutput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  description?: string;
}

export interface NodeConfigSchema {
  type: 'object';
  properties: Record<string, NodeConfigProperty>;
  required?: string[];
}

export interface NodeConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
}

export interface NodeExecutionContext {
  nodeId: string;
  workflowId: string;
  executionId: string;
  input: Record<string, unknown>;
  previousOutputs: Record<string, unknown>;
  config: Record<string, unknown>;
}

export interface NodeExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  metadata?: {
    executionTime?: number;
    tokensUsed?: number;
    cost?: number;
  };
}

