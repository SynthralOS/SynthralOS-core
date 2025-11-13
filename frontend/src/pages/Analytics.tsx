import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

interface WorkflowAnalytics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  totalErrors: number;
  executionsByStatus: Record<string, number>;
  executionsOverTime: Array<{ date: string; count: number }>;
}

interface NodeAnalytics {
  mostUsedNodes: Array<{ nodeId: string; count: number }>;
  nodePerformance: Array<{ nodeId: string; total: number; errors: number; successRate: number }>;
  averageNodeExecutionTime: Record<string, number>;
}

interface CostAnalytics {
  totalTokens: number;
  totalCost: number;
  tokensByNode: Array<{ nodeId: string; tokens: number }>;
  costByNode: Array<{ nodeId: string; cost: number }>;
  costOverTime: Array<{ date: string; cost: number }>;
}

interface ErrorAnalysis {
  commonErrors: Array<{ message: string; count: number }>;
  errorsByNode: Array<{ nodeId: string; count: number }>;
  errorsOverTime: Array<{ date: string; count: number }>;
}

interface UsageStats {
  totalExecutions: number;
  executionsByHour: Array<{ hour: number; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  executionsByDay: Array<{ day: string; count: number }>;
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'nodes' | 'costs' | 'errors' | 'usage'>('workflows');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Conditional queries based on active tab
  const workflowQuery = useQuery({
    queryKey: queryKeys.analytics.workflows(dateRange.start, dateRange.end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const response = await api.get(`/analytics/workflows?${params}`);
      return response.data as WorkflowAnalytics;
    },
    enabled: activeTab === 'workflows',
  });

  const nodeQuery = useQuery({
    queryKey: queryKeys.analytics.nodes(dateRange.start, dateRange.end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const response = await api.get(`/analytics/nodes?${params}`);
      return response.data as NodeAnalytics;
    },
    enabled: activeTab === 'nodes',
  });

  const costQuery = useQuery({
    queryKey: queryKeys.analytics.costs(dateRange.start, dateRange.end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const response = await api.get(`/analytics/costs?${params}`);
      return response.data as CostAnalytics;
    },
    enabled: activeTab === 'costs',
  });

  const errorQuery = useQuery({
    queryKey: queryKeys.analytics.errors(dateRange.start, dateRange.end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const response = await api.get(`/analytics/errors?${params}`);
      return response.data as ErrorAnalysis;
    },
    enabled: activeTab === 'errors',
  });

  const usageQuery = useQuery({
    queryKey: queryKeys.analytics.usage(dateRange.start, dateRange.end),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      const response = await api.get(`/analytics/usage?${params}`);
      return response.data as UsageStats;
    },
    enabled: activeTab === 'usage',
  });

  // Get the active query based on tab
  const activeQuery = 
    activeTab === 'workflows' ? workflowQuery :
    activeTab === 'nodes' ? nodeQuery :
    activeTab === 'costs' ? costQuery :
    activeTab === 'errors' ? errorQuery :
    usageQuery;

  const loading = activeQuery.isLoading;
  const workflowAnalytics = workflowQuery.data;
  const nodeAnalytics = nodeQuery.data;
  const costAnalytics = costQuery.data;
  const errorAnalysis = errorQuery.data;
  const usageStats = usageQuery.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
          Analytics & Monitoring
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor workflow performance, costs, and usage</p>
      </div>

      {/* Date Range Filter */}
      <div className="mb-6 flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Date</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all duration-200 shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all duration-200 shadow-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200/50 dark:border-gray-700/50 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'workflows', label: 'Workflow Analytics' },
            { id: 'nodes', label: 'Node Performance' },
            { id: 'costs', label: 'Cost Tracking' },
            { id: 'errors', label: 'Error Analysis' },
            { id: 'usage', label: 'Usage Statistics' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      ) : (
        <div>
          {activeTab === 'workflows' && workflowAnalytics && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Executions</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">{workflowAnalytics.totalExecutions}</div>
                </div>
                <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-emerald-300/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Success Rate</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-400 dark:to-emerald-500 bg-clip-text text-transparent">{workflowAnalytics.successRate}%</div>
                </div>
                <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-blue-300/50 dark:hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Avg Execution Time</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
                    {Math.round(workflowAnalytics.averageExecutionTime / 1000)}s
                  </div>
                </div>
                <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-red-300/50 dark:hover:border-red-500/50 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Errors</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-700 dark:from-red-400 dark:to-red-500 bg-clip-text text-transparent">{workflowAnalytics.totalErrors}</div>
                </div>
              </div>

              {/* Executions Over Time */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Executions Over Time</h3>
                <div className="h-64 flex items-end gap-2">
                  {workflowAnalytics.executionsOverTime.map((item, idx) => {
                    const maxCount = Math.max(...workflowAnalytics.executionsOverTime.map((i) => i.count));
                    const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-blue-500 rounded-t"
                          style={{ height: `${height}%` }}
                          title={`${item.date}: ${item.count}`}
                        />
                        <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Executions by Status</h3>
                <div className="space-y-2">
                  {Object.entries(workflowAnalytics.executionsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className="capitalize text-gray-700 dark:text-gray-300">{status}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nodes' && nodeAnalytics && (
            <div className="space-y-6">
              {/* Most Used Nodes */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Most Used Nodes</h3>
                <div className="space-y-2">
                  {nodeAnalytics.mostUsedNodes.map((node, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{node.nodeId}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{node.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Node Performance */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Node Performance</h3>
                <div className="space-y-4">
                  {nodeAnalytics.nodePerformance.map((node, idx) => (
                    <div key={idx} className="border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{node.nodeId}</span>
                        <span className={`font-semibold ${node.successRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {node.successRate}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Total: {node.total} | Errors: {node.errors}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'costs' && costAnalytics && (
            <div className="space-y-6">
              {/* Cost Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Tokens</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">{costAnalytics.totalTokens.toLocaleString()}</div>
                </div>
                <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-emerald-300/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Cost</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-400 dark:to-emerald-500 bg-clip-text text-transparent">${costAnalytics.totalCost.toFixed(2)}</div>
                </div>
              </div>

              {/* Cost Over Time */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Cost Over Time</h3>
                <div className="h-64 flex items-end gap-2">
                  {costAnalytics.costOverTime.map((item, idx) => {
                    const maxCost = Math.max(...costAnalytics.costOverTime.map((i) => i.cost));
                    const height = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-green-500 rounded-t"
                          style={{ height: `${height}%` }}
                          title={`${item.date}: $${item.cost.toFixed(2)}`}
                        />
                        <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'errors' && errorAnalysis && (
            <div className="space-y-6">
              {/* Common Errors */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Common Errors</h3>
                <div className="space-y-4">
                  {errorAnalysis.commonErrors.map((error, idx) => (
                    <div key={idx} className="border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0">
                      <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">{error.message}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Count: {error.count}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Errors by Node */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Errors by Node</h3>
                <div className="space-y-2">
                  {errorAnalysis.errorsByNode.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{item.nodeId}</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'usage' && usageStats && (
            <div className="space-y-6">
              {/* Usage Summary */}
              <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Executions</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">{usageStats.totalExecutions}</div>
              </div>

              {/* Executions by Hour */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Executions by Hour of Day</h3>
                <div className="h-64 flex items-end gap-1">
                  {usageStats.executionsByHour.map((item, idx) => {
                    const maxCount = Math.max(...usageStats.executionsByHour.map((i) => i.count));
                    const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-purple-500 rounded-t"
                          style={{ height: `${height}%` }}
                          title={`${item.hour}:00 - ${item.count} executions`}
                        />
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">{item.hour}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Peak Hours */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Peak Hours</h3>
                <div className="space-y-2">
                  {usageStats.peakHours.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className="text-gray-700 dark:text-gray-300">{item.hour}:00</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{item.count} executions</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

