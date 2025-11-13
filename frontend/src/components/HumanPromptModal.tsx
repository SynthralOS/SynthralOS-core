import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';

interface HumanPromptModalProps {
  executionId: string;
  nodeId: string;
  prompt: string;
  inputSchema?: Record<string, unknown>;
  timeout?: number;
  onResponse: (response: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function HumanPromptModal({
  executionId,
  nodeId,
  prompt,
  inputSchema,
  timeout = 3600000,
  onResponse,
  onCancel,
}: HumanPromptModalProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [timeRemaining, setTimeRemaining] = useState(timeout);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submitMutation = useMutation({
    mutationFn: async (response: Record<string, unknown>) => {
      await api.post(`/executions/${executionId}/human-prompt/${nodeId}/respond`, { response });
    },
    onSuccess: () => {
      onResponse(formData);
    },
    onError: (error: any) => {
      alert(`Failed to submit response: ${error.response?.data?.error || error.message}`);
    },
  });

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) {
      onCancel();
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, onCancel]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (inputSchema && inputSchema.properties) {
      const properties = inputSchema.properties as Record<string, any>;
      const required = (inputSchema.required as string[]) || [];

      for (const field of required) {
        if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '')) {
          newErrors[field] = 'This field is required';
        }
      }

      // Type validation
      for (const [field, value] of Object.entries(formData)) {
        const fieldSchema = properties[field];
        if (fieldSchema && value !== undefined && value !== null) {
          if (fieldSchema.type === 'number' && isNaN(Number(value))) {
            newErrors[field] = 'Must be a number';
          } else if (fieldSchema.type === 'boolean' && typeof value !== 'boolean') {
            newErrors[field] = 'Must be true or false';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      submitMutation.mutate(formData);
    }
  };

  const handleFieldChange = (field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const renderField = (field: string, schema: any) => {
    const fieldType = schema.type || 'string';
    const isRequired = (inputSchema?.required as string[])?.includes(field) || false;

    switch (fieldType) {
      case 'string':
        return (
          <div key={field} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {schema.title || field} {isRequired && <span className="text-red-500">*</span>}
            </label>
            {schema.format === 'textarea' || (schema as any).multiline ? (
              <textarea
                value={(formData[field] as string) || ''}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                className={`w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${
                  errors[field] ? 'border-red-500' : 'border-gray-300'
                }`}
                rows={4}
                placeholder={schema.description || ''}
              />
            ) : (
              <input
                type="text"
                value={(formData[field] as string) || ''}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                className={`w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${
                  errors[field] ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={schema.description || ''}
              />
            )}
            {errors[field] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[field]}</p>
            )}
            {schema.description && !errors[field] && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{schema.description}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {schema.title || field} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              value={(formData[field] as number) || ''}
              onChange={(e) => handleFieldChange(field, parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${
                errors[field] ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={schema.description || ''}
            />
            {errors[field] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[field]}</p>
            )}
            {schema.description && !errors[field] && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{schema.description}</p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={field} className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={(formData[field] as boolean) || false}
                onChange={(e) => handleFieldChange(field, e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {schema.title || field} {isRequired && <span className="text-red-500">*</span>}
              </span>
            </label>
            {schema.description && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">{schema.description}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={field} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {schema.title || field} {isRequired && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={JSON.stringify(formData[field] || '')}
              onChange={(e) => {
                try {
                  handleFieldChange(field, JSON.parse(e.target.value));
                } catch {
                  handleFieldChange(field, e.target.value);
                }
              }}
              className={`w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 ${
                errors[field] ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={schema.description || 'Enter JSON value'}
            />
            {errors[field] && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[field]}</p>
            )}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Human Input Required</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Time remaining: {formatTime(timeRemaining)}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>

        {/* Prompt */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <p className="text-gray-900 dark:text-gray-100">{prompt}</p>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4">
          {inputSchema && inputSchema.properties ? (
            <div>
              {Object.entries(inputSchema.properties as Record<string, any>).map(([field, schema]) =>
                renderField(field, schema)
              )}
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Response
              </label>
              <textarea
                value={(formData.response as string) || ''}
                onChange={(e) => handleFieldChange('response', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 rounded"
                rows={6}
                placeholder="Enter your response..."
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

