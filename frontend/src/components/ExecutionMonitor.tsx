import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import VariableInspector from './VariableInspector';
import ExecutionReplay from './ExecutionReplay';
import HumanPromptModal from './HumanPromptModal';
import { io, Socket } from 'socket.io-client';

interface ExecutionLog {
  id: string;
  nodeId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date | string;
}

interface Execution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date | string;
  finishedAt?: Date | string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  metadata?: {
    debugState?: {
      currentNodeId?: string;
      stepMode?: boolean;
      pausedAt?: string;
    };
    humanPrompt?: {
      nodeId: string;
      prompt: string;
      inputSchema?: Record<string, unknown>;
      requestedAt: string;
    };
  };
  logs?: ExecutionLog[];
}

interface ExecutionMonitorProps {
  executionId: string | null;
  onClose: () => void;
}

export default function ExecutionMonitor({ executionId, onClose }: ExecutionMonitorProps) {
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterNodeId, setFilterNodeId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'logs' | 'timeline' | 'data' | 'steps'>('logs');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showVariableInspector, setShowVariableInspector] = useState(false);
  const [inspectorNodeId, setInspectorNodeId] = useState<string | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [showHumanPrompt, setShowHumanPrompt] = useState(false);
  const [humanPromptData, setHumanPromptData] = useState<{
    nodeId: string;
    prompt: string;
    inputSchema?: Record<string, unknown>;
  } | null>(null);
  const [resumeModifications, setResumeModifications] = useState<Record<string, unknown>>({});
  const [socket, setSocket] = useState<Socket | null>(null);
  const queryClient = useQueryClient();

  const { data: execution, isLoading: loading } = useQuery({
    queryKey: ['executions', executionId, filterLevel, filterNodeId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterLevel !== 'all') params.append('level', filterLevel);
      if (filterNodeId) params.append('nodeId', filterNodeId);

      const response = await api.get(`/executions/${executionId}?${params}`);
      return response.data as Execution;
    },
    enabled: !!executionId,
    refetchInterval: execution?.status === 'paused' ? false : 2000, // Don't poll when paused
  });

  const stepMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/executions/${executionId}/step`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions', executionId] });
    },
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!executionId) return;

    // Use window.location.origin if VITE_API_URL is empty (when frontend is served from backend)
    const apiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');
    const newSocket = io(apiUrl, {
      transports: ['websocket'],
    });

    newSocket.emit('join-execution', executionId);
    newSocket.on('execution:human-prompt', (data: {
      executionId: string;
      nodeId: string;
      prompt: string;
      inputSchema?: Record<string, unknown>;
    }) => {
      if (data.executionId === executionId) {
        setHumanPromptData({
          nodeId: data.nodeId,
          prompt: data.prompt,
          inputSchema: data.inputSchema,
        });
        setShowHumanPrompt(true);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave-execution', executionId);
      newSocket.disconnect();
    };
  }, [executionId]);

  // Check for human prompt in metadata
  useEffect(() => {
    if (execution?.metadata?.humanPrompt && !showHumanPrompt) {
      const prompt = execution.metadata.humanPrompt;
      setHumanPromptData({
        nodeId: prompt.nodeId,
        prompt: prompt.prompt,
        inputSchema: prompt.inputSchema,
      });
      setShowHumanPrompt(true);
    }
  }, [execution?.metadata?.humanPrompt, showHumanPrompt]);

  const resumeMutation = useMutation({
    mutationFn: async (modifications?: Record<string, unknown>) => {
      await api.post(`/executions/${executionId}/resume`, {
        modifications: modifications ? {
          nodeId: execution?.metadata?.debugState?.currentNodeId,
          input: modifications,
        } : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions', executionId] });
      setResumeModifications({});
    },
  });

  const handleHumanPromptResponse = (response: Record<string, unknown>) => {
    setShowHumanPrompt(false);
    setHumanPromptData(null);
    queryClient.invalidateQueries({ queryKey: ['executions', executionId] });
  };

  const handleHumanPromptCancel = () => {
    setShowHumanPrompt(false);
    setHumanPromptData(null);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    if (!executionId) return;
    try {
      const response = await api.get(`/executions/${executionId}/export?format=${format}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `execution-${executionId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export execution:', error);
    }
  };

  if (!executionId) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'running':
        return 'text-blue-600 bg-blue-50';
      case 'paused':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const currentNodeId = execution?.metadata?.debugState?.currentNodeId;
  const isStepMode = execution?.metadata?.debugState?.stepMode;

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'warn':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'debug':
        return 'bg-gray-50 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  // Get unique node IDs from logs
  const nodeIds = execution?.logs
    ? Array.from(new Set(execution.logs.map((log) => log.nodeId)))
    : [];

  // Calculate execution duration
  const duration =
    execution?.startedAt && execution?.finishedAt
      ? new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime()
      : execution?.startedAt
      ? Date.now() - new Date(execution.startedAt).getTime()
      : 0;

  // Get node data snapshots
  const nodeDataSnapshots: Record<string, ExecutionLog[]> = {};
  execution?.logs?.forEach((log) => {
    if (!nodeDataSnapshots[log.nodeId]) {
      nodeDataSnapshots[log.nodeId] = [];
    }
    nodeDataSnapshots[log.nodeId].push(log);
  });

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Execution Monitor</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        {execution && (
          <>
            <div className={`px-2 py-1 rounded text-sm font-medium mb-2 ${getStatusColor(execution.status)}`}>
              {execution.status.toUpperCase()}
            </div>
            {execution.status === 'paused' && currentNodeId && (
              <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                <div className="font-semibold text-orange-800">Paused at node:</div>
                <div className="font-mono text-orange-700">{currentNodeId}</div>
                {isStepMode && (
                  <div className="mt-1 text-orange-600">Step mode enabled</div>
                )}
              </div>
            )}
            <div className="text-xs text-gray-600 space-y-1">
              <div>Duration: {Math.round(duration / 1000)}s</div>
              {execution.finishedAt && (
                <div>Finished: {new Date(execution.finishedAt).toLocaleTimeString()}</div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              {(execution.status === 'completed' || execution.status === 'failed') && (
                <button
                  onClick={() => setShowReplay(true)}
                  className="flex-1 px-3 py-1.5 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                >
                  Replay
                </button>
              )}
              {execution.status === 'paused' && (
                <>
                  {isStepMode ? (
                    <button
                      onClick={() => stepMutation.mutate()}
                      disabled={stepMutation.isPending}
                      className="flex-1 px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {stepMutation.isPending ? 'Stepping...' : 'Step Next'}
                    </button>
                  ) : null}
                  <button
                    onClick={() => resumeMutation.mutate(Object.keys(resumeModifications).length > 0 ? resumeModifications : undefined)}
                    disabled={resumeMutation.isPending}
                    className="flex-1 px-3 py-1.5 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    {resumeMutation.isPending ? 'Resuming...' : 'Resume'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Filters and Controls */}
      <div className="p-4 border-b border-gray-200 space-y-2">
        <div className="flex gap-2">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <select
            value={filterNodeId}
            onChange={(e) => setFilterNodeId(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">All Nodes</option>
            {nodeIds.map((nodeId) => (
              <option key={nodeId} value={nodeId}>
                {nodeId}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('logs')}
            className={`flex-1 px-2 py-1 text-sm rounded ${
              viewMode === 'logs' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
          >
            Logs
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`flex-1 px-2 py-1 text-sm rounded ${
              viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('steps')}
            className={`flex-1 px-2 py-1 text-sm rounded ${
              viewMode === 'steps' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            Steps
          </button>
          <button
            onClick={() => setViewMode('data')}
            className={`flex-1 px-2 py-1 text-sm rounded ${
              viewMode === 'data' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            Data
          </button>
        </div>
        {execution?.status === 'paused' && currentNodeId && (
          <button
            onClick={() => {
              setInspectorNodeId(currentNodeId);
              setShowVariableInspector(true);
            }}
            className="w-full px-3 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
          >
            🔍 Inspect Variables
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('json')}
            className="flex-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
          >
            Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && !execution ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : viewMode === 'logs' && execution?.logs && execution.logs.length > 0 ? (
          <div className="space-y-2">
            {execution.logs.map((log) => (
              <div
                key={log.id}
                className={`p-2 rounded text-sm border ${getLevelColor(log.level)}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium font-mono text-xs">{log.nodeId}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div className="text-xs mb-1">
                  {log.message}
                  {log.data && (log.data as any).attempt && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                      Attempt {(log.data as any).attempt}/{(log.data as any).maxAttempts || '?'}
                    </span>
                  )}
                  {log.data && (log.data as any).retryAttempt && (
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                      ✓ Succeeded after {(log.data as any).attempts} attempt(s)
                    </span>
                  )}
                </div>
                {log.data && (
                  <details className="mt-1">
                    <summary className="text-xs cursor-pointer text-gray-600">View Data</summary>
                    <pre className="mt-1 text-xs overflow-x-auto bg-white p-2 rounded border">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : viewMode === 'timeline' && execution?.logs ? (
          <div className="space-y-4">
            {(() => {
              const totalTime = execution?.startedAt
                ? new Date(execution.startedAt).getTime()
                : 0;
              const finishTime = execution?.finishedAt
                ? new Date(execution.finishedAt).getTime()
                : Date.now();
              const totalDuration = finishTime - totalTime;

              // Calculate execution times for all nodes
              const nodeExecutions = nodeIds.map((nodeId) => {
                const nodeLogs = execution.logs?.filter((log) => log.nodeId === nodeId) || [];
                const firstLog = nodeLogs[0];
                const lastLog = nodeLogs[nodeLogs.length - 1];
                const startTime = firstLog ? new Date(firstLog.timestamp).getTime() : 0;
                const endTime = lastLog ? new Date(lastLog.timestamp).getTime() : 0;
                const nodeStart = startTime - totalTime;
                const nodeDuration = endTime - startTime;
                const leftPercent = totalDuration > 0 ? (nodeStart / totalDuration) * 100 : 0;
                const widthPercent = totalDuration > 0 ? (nodeDuration / totalDuration) * 100 : 0;

                return {
                  nodeId,
                  nodeLogs,
                  startTime,
                  endTime,
                  nodeStart,
                  nodeDuration,
                  leftPercent,
                  widthPercent,
                };
              });

              // Detect parallel execution (nodes that overlap in time)
              const parallelGroups: Array<Array<typeof nodeExecutions[0]>> = [];
              const processed = new Set<string>();

              nodeExecutions.forEach((exec) => {
                if (processed.has(exec.nodeId)) return;

                const parallel = [exec];
                processed.add(exec.nodeId);

                // Find all nodes that execute in parallel with this one
                nodeExecutions.forEach((otherExec) => {
                  if (processed.has(otherExec.nodeId)) return;
                  
                  // Check if execution times overlap
                  const overlaps =
                    (otherExec.startTime >= exec.startTime && otherExec.startTime <= exec.endTime) ||
                    (otherExec.endTime >= exec.startTime && otherExec.endTime <= exec.endTime) ||
                    (otherExec.startTime <= exec.startTime && otherExec.endTime >= exec.endTime);

                  if (overlaps) {
                    parallel.push(otherExec);
                    processed.add(otherExec.nodeId);
                  }
                });

                if (parallel.length > 1) {
                  parallelGroups.push(parallel);
                }
              });

              return nodeExecutions.map((exec) => {
                // Check if this node is part of a parallel group
                const parallelGroup = parallelGroups.find((group) =>
                  group.some((e) => e.nodeId === exec.nodeId)
                );
                const isParallel = parallelGroup && parallelGroup.length > 1;
                const parallelIndex = parallelGroup
                  ? parallelGroup.findIndex((e) => e.nodeId === exec.nodeId)
                  : 0;
                const parallelCount = parallelGroup ? parallelGroup.length : 1;
                const isCurrentNode = exec.nodeId === currentNodeId;

                return (
                  <div key={exec.nodeId} className={`relative ${isCurrentNode ? 'ring-2 ring-orange-500 rounded p-1' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`text-xs font-mono ${isCurrentNode ? 'font-bold text-orange-700' : ''}`}>
                        {exec.nodeId}
                        {isCurrentNode && ' ⏸'}
                      </div>
                      {isParallel && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                          ⚡ Parallel ({parallelCount} nodes)
                        </span>
                      )}
                    </div>
                    <div className="relative h-8 bg-gray-100 rounded">
                      <div
                        className={`absolute h-full rounded ${
                          isParallel ? 'bg-purple-500' : 'bg-blue-500'
                        }`}
                        style={{
                          left: `${exec.leftPercent}%`,
                          width: `${Math.max(exec.widthPercent, 1)}%`,
                          opacity: isParallel ? 0.7 + (parallelIndex * 0.1) : 1,
                          zIndex: isParallel ? 10 - parallelIndex : 1,
                        }}
                        title={`${Math.round(exec.nodeDuration)}ms${isParallel ? ` (Parallel with ${parallelCount - 1} other node${parallelCount > 2 ? 's' : ''})` : ''}`}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {exec.nodeLogs.length} log{exec.nodeLogs.length !== 1 ? 's' : ''}
                      {isParallel && ` • Parallel execution`}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        ) : viewMode === 'data' ? (
          <div className="space-y-4">
            {Object.entries(nodeDataSnapshots).map(([nodeId, logs]) => {
              const lastLog = logs[logs.length - 1];
              return (
                <div
                  key={nodeId}
                  className="border rounded p-2 cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedNodeId(selectedNodeId === nodeId ? null : nodeId)}
                >
                  <div className="font-mono text-sm font-semibold mb-1">{nodeId}</div>
                  {selectedNodeId === nodeId && lastLog?.data && (
                    <pre className="text-xs overflow-x-auto bg-gray-50 p-2 rounded mt-2">
                      {JSON.stringify(lastLog.data, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        ) : viewMode === 'steps' ? (
          <StepsView executionId={executionId!} />
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm">No logs yet</div>
        )}
      </div>
      {showVariableInspector && (
        <VariableInspector
          executionId={executionId!}
          nodeId={inspectorNodeId || currentNodeId || null}
          onClose={() => {
            setShowVariableInspector(false);
            setInspectorNodeId(null);
          }}
        />
      )}
      {showHumanPrompt && humanPromptData && (
        <HumanPromptModal
          executionId={executionId!}
          nodeId={humanPromptData.nodeId}
          prompt={humanPromptData.prompt}
          inputSchema={humanPromptData.inputSchema}
          onResponse={handleHumanPromptResponse}
          onCancel={handleHumanPromptCancel}
        />
      )}
      {showReplay && (
        <ExecutionReplay
          executionId={executionId!}
          onClose={() => setShowReplay(false)}
          onReplay={(newExecutionId) => {
            setShowReplay(false);
            queryClient.invalidateQueries({ queryKey: ['executions'] });
          }}
        />
      )}
    </div>
  );
}

// Steps View Component
function StepsView({ executionId }: { executionId: string }) {
  const { data: steps, isLoading } = useQuery({
    queryKey: ['executions', executionId, 'steps'],
    queryFn: async () => {
      const response = await api.get(`/executions/${executionId}/steps`);
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="text-center text-gray-500 dark:text-gray-400">Loading steps...</div>;
  }

  if (!steps || steps.length === 0) {
    return <div className="text-center text-gray-500 dark:text-gray-400">No steps found</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  return (
    <div className="space-y-2">
      {steps.map((step: any) => (
        <div
          key={step.id}
          className={`border rounded p-3 text-sm ${getStatusColor(step.status)}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">Step {step.stepNumber}</span>
              <span className="font-mono font-semibold">{step.nodeId}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(step.status)}`}>
              {step.status}
            </span>
          </div>
          {step.executionTime && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Duration: {step.executionTime}ms
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
