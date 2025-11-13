import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface VariableSnapshot {
  nodeId: string;
  timestamp: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  previousOutputs: Record<string, unknown>;
  allResults: Record<string, unknown>;
}

interface VariableInspectorProps {
  executionId: string;
  nodeId: string | null;
  onClose: () => void;
}

export default function VariableInspector({ executionId, nodeId, onClose }: VariableInspectorProps) {
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<'input' | 'output' | 'previousOutputs' | 'allResults'>('input');
  const queryClient = useQueryClient();

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['executions', executionId, 'variables', nodeId],
    queryFn: async () => {
      if (!nodeId) return null;
      const response = await api.get(`/executions/${executionId}/variables/${nodeId}`);
      return response.data as VariableSnapshot;
    },
    enabled: !!nodeId && !!executionId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ path, value }: { path: string; value: unknown }) => {
      await api.put(`/executions/${executionId}/variables/${nodeId}`, { path, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executions', executionId, 'variables', nodeId] });
      setEditingPath(null);
    },
  });

  const handleEdit = (path: string, currentValue: unknown) => {
    setEditingPath(path);
    setEditValue(JSON.stringify(currentValue, null, 2));
  };

  const handleSave = () => {
    if (!editingPath) return;
    try {
      const parsedValue = JSON.parse(editValue);
      updateMutation.mutate({ path: editingPath, value: parsedValue });
    } catch (error) {
      alert('Invalid JSON. Please check your input.');
    }
  };

  const handleCancel = () => {
    setEditingPath(null);
    setEditValue('');
  };

  const renderValue = (value: unknown, path: string = ''): JSX.Element => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">null</span>;
    }

    if (typeof value === 'string') {
      return <span className="text-green-700">"{value}"</span>;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-blue-700">{String(value)}</span>;
    }

    if (Array.isArray(value)) {
      return (
        <div className="ml-4 border-l-2 border-gray-300 pl-2">
          <span className="text-gray-500">[</span>
          {value.map((item, index) => (
            <div key={index} className="ml-2">
              {renderValue(item, `${path}[${index}]`)}
              {index < value.length - 1 && <span className="text-gray-500">,</span>}
            </div>
          ))}
          <span className="text-gray-500">]</span>
        </div>
      );
    }

    if (typeof value === 'object') {
      return (
        <div className="ml-4 border-l-2 border-gray-300 pl-2">
          <span className="text-gray-500">{'{'}</span>
          {Object.entries(value).map(([key, val], index, arr) => (
            <div key={key} className="ml-2">
              <span className="text-purple-700">"{key}"</span>
              <span className="text-gray-500">: </span>
              {editingPath === `${path}.${key}` ? (
                <div className="mt-1">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-2 py-1 border border-blue-500 rounded text-xs font-mono"
                    rows={4}
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={handleSave}
                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {renderValue(val, path ? `${path}.${key}` : key)}
                  {index < arr.length - 1 && <span className="text-gray-500">,</span>}
                  <button
                    onClick={() => handleEdit(path ? `${path}.${key}` : key, val)}
                    className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                  >
                    ✏️ Edit
                  </button>
                </>
              )}
            </div>
          ))}
          <span className="text-gray-500">{'}'}</span>
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  if (!nodeId) {
    return (
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full p-4">
        <div className="text-center text-gray-500">Select a node to inspect variables</div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Variable Inspector</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        <div className="text-xs text-gray-600">
          Node: <span className="font-mono">{nodeId}</span>
        </div>
        {snapshot && (
          <div className="text-xs text-gray-500 mt-1">
            Snapshot: {new Date(snapshot.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : !snapshot ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">No variable snapshot available</div>
        </div>
      ) : (
        <>
          <div className="p-2 border-b border-gray-200 flex gap-1">
            <button
              onClick={() => setSelectedSection('input')}
              className={`px-3 py-1 text-xs rounded ${
                selectedSection === 'input' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Input
            </button>
            <button
              onClick={() => setSelectedSection('output')}
              className={`px-3 py-1 text-xs rounded ${
                selectedSection === 'output' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Output
            </button>
            <button
              onClick={() => setSelectedSection('previousOutputs')}
              className={`px-3 py-1 text-xs rounded ${
                selectedSection === 'previousOutputs' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setSelectedSection('allResults')}
              className={`px-3 py-1 text-xs rounded ${
                selectedSection === 'allResults' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              All Results
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="font-mono text-xs">
              {selectedSection === 'input' && renderValue(snapshot.input, 'input')}
              {selectedSection === 'output' && renderValue(snapshot.output, 'output')}
              {selectedSection === 'previousOutputs' && renderValue(snapshot.previousOutputs, 'previousOutputs')}
              {selectedSection === 'allResults' && renderValue(snapshot.allResults, 'allResults')}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


