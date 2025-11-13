import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

interface WorkflowVersion {
  id: string;
  version: number;
  createdAt: string;
  createdBy?: string;
}

interface WorkflowVersionsProps {
  workflowId: string;
  onVersionRestore?: () => void;
  onClose: () => void;
}

export default function WorkflowVersions({ workflowId, onVersionRestore, onClose }: WorkflowVersionsProps) {
  const queryClient = useQueryClient();
  const [restoring, setRestoring] = useState<string | null>(null);

  const { data: workflow, isLoading: loading } = useQuery({
    queryKey: queryKeys.workflows.detail(workflowId),
    queryFn: async () => {
      const response = await api.get(`/workflows/${workflowId}`);
      return response.data;
    },
  });

  const versions = workflow?.versions || [];

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      await api.post(`/workflows/${workflowId}/versions/${versionId}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(workflowId) });
      if (onVersionRestore) {
        onVersionRestore();
      }
      alert('Version restored successfully!');
      setRestoring(null);
    },
    onError: (error: any) => {
      console.error('Failed to restore version:', error);
      alert(`Failed to restore version: ${error.response?.data?.error || error.message}`);
      setRestoring(null);
    },
  });

  const handleRestore = (versionId: string) => {
    if (!confirm('Are you sure you want to restore this version? The current version will be saved as a new version.')) {
      return;
    }
    setRestoring(versionId);
    restoreMutation.mutate(versionId);
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Workflow Versions</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-500">View and restore previous versions</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-gray-500 text-sm py-8">Loading versions...</div>
        ) : versions.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">No versions yet</div>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-sm">Version {version.version}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(version.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestore(version.id)}
                      disabled={restoring === version.id || restoreMutation.isPending}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {restoring === version.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

