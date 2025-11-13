import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface ExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  stepNumber: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: Record<string, unknown>;
  startedAt?: Date | string;
  finishedAt?: Date | string;
  executionTime?: number;
  retryAttempt: number;
}

interface ExecutionReplayProps {
  executionId: string;
  onClose: () => void;
  onReplay?: (newExecutionId: string) => void;
}

export default function ExecutionReplay({ executionId, onClose, onReplay }: ExecutionReplayProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showModifications, setShowModifications] = useState(false);
  const [modifications, setModifications] = useState<Record<string, Record<string, unknown>>>({});
  const queryClient = useQueryClient();

  const { data: steps, isLoading: loadingSteps } = useQuery({
    queryKey: ['executions', executionId, 'steps'],
    queryFn: async () => {
      const response = await api.get(`/executions/${executionId}/steps`);
      return response.data as ExecutionStep[];
    },
    enabled: !!executionId,
  });

  const replayMutation = useMutation({
    mutationFn: async (options?: { fromStepId?: string; skipCompleted?: boolean }) => {
      if (options?.fromStepId) {
        const response = await api.post(`/executions/${executionId}/replay/${options.fromStepId}`, {
          options: {
            skipCompleted: options.skipCompleted,
            modifyInputs: modifications,
          },
        });
        return response.data;
      } else {
        const response = await api.post(`/executions/${executionId}/replay`, {
          options: {
            skipCompleted: options?.skipCompleted,
            modifyInputs: modifications,
          },
        });
        return response.data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      if (onReplay && data.executionId) {
        onReplay(data.executionId);
      }
      alert('Execution replayed successfully!');
      onClose();
    },
    onError: (error: any) => {
      alert(`Failed to replay execution: ${error.response?.data?.error || error.message}`);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleReplayFromStep = (stepId: string) => {
    if (confirm('Replay execution from this step? This will create a new execution.')) {
      replayMutation.mutate({ fromStepId: stepId, skipCompleted: false });
    }
  };

  const handleReplayAll = () => {
    if (confirm('Replay entire execution? This will create a new execution.')) {
      replayMutation.mutate({ skipCompleted: false });
    }
  };

  const handleModifyInput = (stepId: string, field: string, value: unknown) => {
    setModifications((prev) => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        [field]: value,
      },
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Execution Replay - {executionId.slice(0, 8)}...
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowModifications(!showModifications)}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {showModifications ? 'Hide' : 'Show'} Modifications
            </button>
            <button
              onClick={handleReplayAll}
              disabled={replayMutation.isPending}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {replayMutation.isPending ? 'Replaying...' : 'Replay All'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingSteps ? (
            <div className="text-center text-gray-500 dark:text-gray-400">Loading steps...</div>
          ) : !steps || steps.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400">No steps found</div>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`border rounded-lg p-4 ${getStatusColor(step.status)} ${
                    selectedStepId === step.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs bg-white dark:bg-gray-700 px-2 py-0.5 rounded">
                          Step {step.stepNumber}
                        </span>
                        <span className="font-mono text-sm font-semibold">{step.nodeId}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(step.status)}`}>
                          {step.status}
                        </span>
                        {step.retryAttempt > 0 && (
                          <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-xs">
                            Retry {step.retryAttempt}
                          </span>
                        )}
                      </div>
                      {step.startedAt && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Started: {new Date(step.startedAt).toLocaleString()}
                          {step.executionTime && ` • Duration: ${step.executionTime}ms`}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleReplayFromStep(step.id)}
                      disabled={replayMutation.isPending || step.status === 'pending'}
                      className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      Replay From Here
                    </button>
                  </div>

                  {/* Input/Output */}
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <div className="text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Input</div>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 dark:text-gray-400">View Input</summary>
                        <pre className="mt-1 p-2 bg-white dark:bg-gray-900 rounded border overflow-x-auto max-h-40">
                          {JSON.stringify(step.input || {}, null, 2)}
                        </pre>
                      </details>
                      {showModifications && (
                        <div className="mt-2">
                          <input
                            type="text"
                            placeholder="Modify input (JSON)"
                            className="w-full px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600"
                            onChange={(e) => {
                              try {
                                const value = JSON.parse(e.target.value);
                                handleModifyInput(step.id, 'input', value);
                              } catch {
                                // Invalid JSON, ignore
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Output</div>
                      {step.error ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-red-600 dark:text-red-400">View Error</summary>
                          <pre className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 overflow-x-auto max-h-40">
                            {JSON.stringify(step.error, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-600 dark:text-gray-400">View Output</summary>
                          <pre className="mt-1 p-2 bg-white dark:bg-gray-900 rounded border overflow-x-auto max-h-40">
                            {JSON.stringify(step.output || {}, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

