export interface Workflow {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  definition: WorkflowDefinition;
  active: boolean;
  settings?: WorkflowSettings;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowGroup {
  id: string;
  label: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  };
  nodeIds: string[]; // IDs of nodes in this group
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups?: WorkflowGroup[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  selected?: boolean;
  dragging?: boolean;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
}

export interface WorkflowSettings {
  timeout?: number;
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoff: 'fixed' | 'exponential';
    delay: number;
  };
  errorHandling?: {
    continueOnError: boolean;
    errorPath?: string;
  };
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  definition: WorkflowDefinition;
  createdBy?: string;
  createdAt: Date;
}

