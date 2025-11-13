import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { useState } from 'react';

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  successCount: number;
  lastRequestAt: string;
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  requests: {
    total: number;
    perSecond: number;
    errors: number;
    successRate: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  database: {
    queryCount: number;
    averageQueryTime: number;
  };
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  size: number;
}

export default function PerformanceMonitoring() {
  const queryClient = useQueryClient();
  const [selectedView, setSelectedView] = useState<'overview' | 'endpoints' | 'system' | 'cache'>('overview');
  const [selectedEndpoint, setSelectedEndpoint] = useState<{ method: string; endpoint: string } | null>(null);

  const { data: metrics = [], isLoading: metricsLoading } = useQuery<PerformanceMetrics[]>({
    queryKey: queryKeys.performanceMonitoring.all,
    queryFn: async () => {
      const response = await api.get('/monitoring/performance');
      return response.data.metrics;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: systemMetrics, isLoading: systemLoading } = useQuery<SystemMetrics>({
    queryKey: queryKeys.performanceMonitoring.system,
    queryFn: async () => {
      const response = await api.get('/monitoring/performance/system');
      return response.data;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
    enabled: selectedView === 'system' || selectedView === 'overview',
  });

  const { data: slowestEndpoints = [] } = useQuery<PerformanceMetrics[]>({
    queryKey: queryKeys.performanceMonitoring.slowest(10),
    queryFn: async () => {
      const response = await api.get('/monitoring/performance/slowest?limit=10');
      return response.data.endpoints;
    },
    refetchInterval: 10000,
    enabled: selectedView === 'endpoints' || selectedView === 'overview',
  });

  const { data: mostRequested = [] } = useQuery<PerformanceMetrics[]>({
    queryKey: queryKeys.performanceMonitoring.mostRequested(10),
    queryFn: async () => {
      const response = await api.get('/monitoring/performance/most-requested?limit=10');
      return response.data.endpoints;
    },
    refetchInterval: 10000,
    enabled: selectedView === 'endpoints' || selectedView === 'overview',
  });

  const { data: cacheStats, isLoading: cacheLoading } = useQuery<CacheStats>({
    queryKey: queryKeys.performanceMonitoring.cache,
    queryFn: async () => {
      const response = await api.get('/monitoring/performance/cache');
      return response.data;
    },
    refetchInterval: 10000,
    enabled: selectedView === 'cache' || selectedView === 'overview',
  });

  const { data: endpointDetail } = useQuery<PerformanceMetrics>({
    queryKey: selectedEndpoint 
      ? queryKeys.performanceMonitoring.endpoint(selectedEndpoint.method, selectedEndpoint.endpoint)
      : [''],
    queryFn: async () => {
      if (!selectedEndpoint) return null;
      const response = await api.get(
        `/monitoring/performance/endpoint/${selectedEndpoint.method}/${encodeURIComponent(selectedEndpoint.endpoint)}`
      );
      return response.data;
    },
    enabled: !!selectedEndpoint,
  });

  const resetMetricsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/monitoring/performance/reset');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.performanceMonitoring.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.performanceMonitoring.system });
      alert('Metrics reset successfully!');
    },
    onError: (error: any) => {
      alert(`Failed to reset metrics: ${error.response?.data?.error || error.message}`);
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1) return `${Math.round(ms * 1000)}μs`;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (metricsLoading && selectedView === 'endpoints') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading performance metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">Performance Monitoring</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor API performance, system metrics, and cache statistics</p>
        </div>
        <button
          onClick={() => {
            if (confirm('Reset all performance metrics? This action cannot be undone.')) {
              resetMetricsMutation.mutate();
            }
          }}
          disabled={resetMetricsMutation.isPending}
          className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 transition-all"
        >
          {resetMetricsMutation.isPending ? 'Resetting...' : 'Reset Metrics'}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200/50 dark:border-gray-700/50 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSelectedView('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              selectedView === 'overview'
                ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedView('endpoints')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              selectedView === 'endpoints'
                ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Endpoints
          </button>
          <button
            onClick={() => setSelectedView('system')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              selectedView === 'system'
                ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            System
          </button>
          <button
            onClick={() => setSelectedView('cache')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              selectedView === 'cache'
                ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Cache
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* System Metrics Summary */}
          {systemMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Memory Usage</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
                  {formatBytes(systemMetrics.memory.used)} / {formatBytes(systemMetrics.memory.total)}
                </div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full"
                      style={{ width: `${systemMetrics.memory.percentage}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {systemMetrics.memory.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-blue-300/50 dark:hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Requests/sec</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
                  {systemMetrics.requests.perSecond.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {systemMetrics.requests.total} total requests
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-emerald-300/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Success Rate</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-400 dark:to-emerald-500 bg-clip-text text-transparent">
                  {systemMetrics.requests.successRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {systemMetrics.requests.errors} errors
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Cache Hit Rate</div>
                <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-400 dark:to-indigo-500 bg-clip-text text-transparent">
                  {(systemMetrics.cache.hitRate * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {systemMetrics.cache.hits} hits / {systemMetrics.cache.misses} misses
                </div>
              </div>
            </div>
          )}

          {/* Slowest Endpoints */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Slowest Endpoints</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Endpoint</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Min</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Max</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Requests</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {slowestEndpoints.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    slowestEndpoints.map((endpoint) => (
                      <tr key={`${endpoint.method}:${endpoint.endpoint}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400">
                            {endpoint.method}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 font-mono">{endpoint.endpoint}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatTime(endpoint.averageTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatTime(endpoint.minTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatTime(endpoint.maxTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {endpoint.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedEndpoint({ method: endpoint.method, endpoint: endpoint.endpoint })}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Endpoints Tab */}
      {selectedView === 'endpoints' && (
        <div className="space-y-6">
          {/* Most Requested */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Most Requested Endpoints</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Endpoint</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Requests</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Success Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Request</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {mostRequested.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    mostRequested.map((endpoint) => {
                      const successRate = endpoint.count > 0
                        ? ((endpoint.successCount / endpoint.count) * 100).toFixed(1)
                        : '0';
                      return (
                        <tr key={`${endpoint.method}:${endpoint.endpoint}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400">
                              {endpoint.method}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 font-mono">{endpoint.endpoint}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {endpoint.count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {formatTime(endpoint.averageTime)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={parseFloat(successRate) >= 95 ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'}>
                              {successRate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {new Date(endpoint.lastRequestAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => setSelectedEndpoint({ method: endpoint.method, endpoint: endpoint.endpoint })}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* All Endpoints */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">All Endpoints</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Endpoint</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Requests</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Errors</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {metrics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    metrics.map((endpoint) => (
                      <tr key={`${endpoint.method}:${endpoint.endpoint}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400">
                            {endpoint.method}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 font-mono">{endpoint.endpoint}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {endpoint.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatTime(endpoint.averageTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {endpoint.errorCount > 0 ? (
                            <span className="text-red-600 dark:text-red-400">{endpoint.errorCount}</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedEndpoint({ method: endpoint.method, endpoint: endpoint.endpoint })}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* System Tab */}
      {selectedView === 'system' && systemMetrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Memory Usage</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Used</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBytes(systemMetrics.memory.used)}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-4 rounded-full"
                      style={{ width: `${systemMetrics.memory.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>0</span>
                    <span>{formatBytes(systemMetrics.memory.total)}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Usage: {systemMetrics.memory.percentage.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Request Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Requests</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{systemMetrics.requests.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Requests/sec</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{systemMetrics.requests.perSecond.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Errors</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">{systemMetrics.requests.errors}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Success Rate</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {systemMetrics.requests.successRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cache Tab */}
      {selectedView === 'cache' && cacheStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-emerald-300/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Cache Hits</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-400 dark:to-emerald-500 bg-clip-text text-transparent">{cacheStats.hits.toLocaleString()}</div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-red-300/50 dark:hover:border-red-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Cache Misses</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-700 dark:from-red-400 dark:to-red-500 bg-clip-text text-transparent">{cacheStats.misses.toLocaleString()}</div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Hit Rate</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-400 dark:to-indigo-500 bg-clip-text text-transparent">
                {(cacheStats.hitRate * 100).toFixed(1)}%
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Cache Size</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">{cacheStats.size.toLocaleString()}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">keys</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Cache Operations</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Sets</div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{cacheStats.sets.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Deletes</div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{cacheStats.deletes.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Endpoint Detail Modal */}
      {selectedEndpoint && endpointDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Endpoint Performance Details</h2>
              <button
                onClick={() => setSelectedEndpoint(null)}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                ✕ Close
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Method</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400">
                      {endpointDetail.method}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Endpoint</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">{endpointDetail.endpoint}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Requests</label>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{endpointDetail.count}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Time</label>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatTime(endpointDetail.averageTime)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Min Time</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatTime(endpointDetail.minTime)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Max Time</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatTime(endpointDetail.maxTime)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Success Count</label>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{endpointDetail.successCount}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Error Count</label>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{endpointDetail.errorCount}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Success Rate</label>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {endpointDetail.count > 0
                      ? ((endpointDetail.successCount / endpointDetail.count) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Time</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatTime(endpointDetail.totalTime)}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Request</label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {new Date(endpointDetail.lastRequestAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

