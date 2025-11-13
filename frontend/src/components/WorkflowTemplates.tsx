import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { queryKeys } from '../lib/queryKeys';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  definition: {
    nodes: unknown[];
    edges: unknown[];
  };
}

interface WorkflowTemplatesProps {
  onClose: () => void;
  onSelect?: (template: Template) => void;
}

export default function WorkflowTemplates({ onClose, onSelect }: WorkflowTemplatesProps) {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: templates = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.templates.all,
    queryFn: async () => {
      const response = await api.get('/templates');
      return response.data;
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (workflowData: any) => {
      const response = await api.post('/workflows', workflowData);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
      navigate(`/workflows/${data.id}`);
      onClose();
    },
    onError: (error: any) => {
      console.error('Failed to create workflow from template:', error);
      alert(`Failed to create workflow: ${error.response?.data?.error || error.message}`);
    },
  });

  const handleUseTemplate = async (template: Template) => {
    if (onSelect) {
      onSelect(template);
      onClose();
      return;
    }

    // Increment template usage count
    try {
      await api.post(`/templates/${template.id}/use`);
    } catch (error) {
      // Non-critical, continue even if usage tracking fails
      console.warn('Failed to increment template usage:', error);
    }

    // Create workflow from template
    const workflowData = {
      name: template.name,
      description: template.description,
      // workspaceId will be auto-created by backend if not provided
      workspaceId: 'default-workspace',
      definition: template.definition,
      active: false,
    };

    createWorkflowMutation.mutate(workflowData);
  };

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  const filteredTemplates = templates.filter((template) => {
    if (!selectedCategory) return true;
    return template.category === selectedCategory;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Workflow Templates</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ✕
            </button>
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 rounded text-sm ${
                !selectedCategory
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded text-sm capitalize ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No templates found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{template.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 capitalize">{template.category}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const response = await api.get(`/templates/${template.id}`);
                            const templateDetail = response.data;
                            alert(`Template: ${templateDetail.name}\n\nDescription: ${templateDetail.description || 'No description'}\n\nNodes: ${templateDetail.definition?.nodes?.length || 0}\nEdges: ${templateDetail.definition?.edges?.length || 0}`);
                          } catch (error) {
                            console.error('Failed to load template details:', error);
                            alert('Failed to load template details');
                          }
                        }}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                        disabled={createWorkflowMutation.isPending}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleUseTemplate(template)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
                        disabled={createWorkflowMutation.isPending}
                      >
                        {createWorkflowMutation.isPending ? 'Creating...' : 'Use Template'}
                      </button>
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

