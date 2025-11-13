import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { useState } from 'react';

interface TriggerHealth {
  triggerId: string;
  workflowId: string;
  provider: string;
  email: string;
  status: 'healthy' | 'unhealthy' | 'error';
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  consecutiveFailures: number;
  errorMessage?: string;
}

interface TriggerMetrics {
  totalTriggers: number;
  activeTriggers: number;
  healthyTriggers: number;
  unhealthyTriggers: number;
  triggersByProvider: Record<string, number>;
  totalEmailsProcessed: number;
  totalWorkflowsTriggered: number;
  averagePollInterval: number;
  tokenRefreshFailures: number;
}

interface Alert {
  id: string;
  type: 'token_refresh_failed' | 'consecutive_failures' | 'rate_limit_warning' | 'connection_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  triggerId: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface HealthSummary {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  metrics: TriggerMetrics;
  recentAlerts: Alert[];
  unhealthyTriggers: TriggerHealth[];
}

export default function EmailTriggerMonitoring() {
  const queryClient = useQueryClient();
  const [selectedView, setSelectedView] = useState<'overview' | 'health' | 'alerts' | 'metrics'>('overview');
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);

  const { data: healthSummary, isLoading } = useQuery<HealthSummary>({
    queryKey: queryKeys.emailTriggerMonitoring.health,
    queryFn: async () => {
      const response = await api.get('/email-triggers/monitoring/health');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: allHealth } = useQuery<TriggerHealth[]>({
    queryKey: queryKeys.emailTriggerMonitoring.healthAll,
    queryFn: async () => {
      const response = await api.get('/email-triggers/monitoring/health/all');
      return response.data;
    },
    refetchInterval: 30000,
    enabled: selectedView === 'health',
  });

  const { data: alertsData } = useQuery<{ alerts: Alert[] }>({
    queryKey: queryKeys.emailTriggerMonitoring.alerts('limit=50'),
    queryFn: async () => {
      const response = await api.get('/email-triggers/monitoring/alerts?limit=50');
      return response.data;
    },
    refetchInterval: 30000,
    enabled: selectedView === 'alerts',
  });

  const { data: metricsData } = useQuery<TriggerMetrics>({
    queryKey: queryKeys.emailTriggerMonitoring.metrics,
    queryFn: async () => {
      const response = await api.get('/email-triggers/monitoring/metrics');
      return response.data;
    },
    refetchInterval: 30000,
    enabled: selectedView === 'metrics',
  });

  const { data: triggerHealthDetail } = useQuery<TriggerHealth>({
    queryKey: queryKeys.emailTriggerMonitoring.healthDetail(selectedTriggerId || ''),
    queryFn: async () => {
      const response = await api.get(`/email-triggers/monitoring/health/${selectedTriggerId}`);
      return response.data;
    },
    enabled: !!selectedTriggerId,
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await api.post(`/email-triggers/monitoring/alerts/${alertId}/resolve`);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate alerts query to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTriggerMonitoring.alerts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTriggerMonitoring.health });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'unhealthy':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOverallColor = (overall: string) => {
    switch (overall) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'unhealthy':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  if (!healthSummary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
        <div className="text-center py-12 text-red-600 dark:text-red-400">Failed to load monitoring data</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">Email Trigger Monitoring</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor the health and performance of email triggers</p>
      </div>

      {/* Overall Health Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Overall Health</h2>
          <span className={`text-2xl font-bold ${getOverallColor(healthSummary.overall)}`}>
            {healthSummary.overall.toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Total Triggers</div>
            <div className="text-2xl font-semibold">{healthSummary.metrics.totalTriggers}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Healthy</div>
            <div className="text-2xl font-semibold text-green-600">{healthSummary.metrics.healthyTriggers}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Unhealthy</div>
            <div className="text-2xl font-semibold text-red-600">{healthSummary.metrics.unhealthyTriggers}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Active Alerts</div>
            <div className="text-2xl font-semibold text-orange-600">{healthSummary.recentAlerts.length}</div>
          </div>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Emails Processed</div>
            <div className="text-xl font-semibold">{healthSummary.metrics.totalEmailsProcessed.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Workflows Triggered</div>
            <div className="text-xl font-semibold">{healthSummary.metrics.totalWorkflowsTriggered.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Avg Poll Interval</div>
            <div className="text-xl font-semibold">{healthSummary.metrics.averagePollInterval}s</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Token Refresh Failures</div>
            <div className="text-xl font-semibold text-red-600">{healthSummary.metrics.tokenRefreshFailures}</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-sm text-gray-600 mb-2">Triggers by Provider</div>
          <div className="flex gap-4">
            {Object.entries(healthSummary.metrics.triggersByProvider).map(([provider, count]) => (
              <div key={provider} className="px-3 py-1 bg-gray-100 rounded">
                <span className="font-semibold">{provider}:</span> {count}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setSelectedView('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedView === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedView('health')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedView === 'health'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Trigger Health
          </button>
          <button
            onClick={() => setSelectedView('alerts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedView === 'alerts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Alerts ({healthSummary.recentAlerts.length})
          </button>
          <button
            onClick={() => setSelectedView('metrics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              selectedView === 'metrics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Metrics
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Recent Alerts */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Recent Alerts</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {healthSummary.recentAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No recent alerts
                      </td>
                    </tr>
                  ) : (
                    healthSummary.recentAlerts.map((alert) => (
                      <tr key={alert.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{alert.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{alert.triggerId.substring(0, 8)}...</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{alert.message}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(alert.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unhealthy Triggers */}
          {healthSummary.unhealthyTriggers.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Unhealthy Triggers</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failures</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Error</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {healthSummary.unhealthyTriggers.map((trigger) => (
                      <tr key={trigger.triggerId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trigger.provider}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trigger.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(trigger.status)}`}>
                            {trigger.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trigger.consecutiveFailures}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {trigger.errorMessage || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Health Tab */}
      {selectedView === 'health' && allHealth && (
        <div className="space-y-6">
          {selectedTriggerId && triggerHealthDetail ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Trigger Health Details</h2>
                <button
                  onClick={() => setSelectedTriggerId(null)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  ← Back to List
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Trigger ID</label>
                    <p className="text-sm text-gray-900 font-mono">{triggerHealthDetail.triggerId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Workflow ID</label>
                    <p className="text-sm text-gray-900 font-mono">{triggerHealthDetail.workflowId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Provider</label>
                    <p className="text-sm text-gray-900">{triggerHealthDetail.provider}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-sm text-gray-900">{triggerHealthDetail.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(triggerHealthDetail.status)}`}>
                      {triggerHealthDetail.status}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Consecutive Failures</label>
                    <p className="text-sm text-gray-900">{triggerHealthDetail.consecutiveFailures}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Checked</label>
                    <p className="text-sm text-gray-900">
                      {triggerHealthDetail.lastCheckedAt ? new Date(triggerHealthDetail.lastCheckedAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Success</label>
                    <p className="text-sm text-gray-900">
                      {triggerHealthDetail.lastSuccessAt ? new Date(triggerHealthDetail.lastSuccessAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Error</label>
                    <p className="text-sm text-gray-900">
                      {triggerHealthDetail.lastErrorAt ? new Date(triggerHealthDetail.lastErrorAt).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
                {triggerHealthDetail.errorMessage && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Error Message</label>
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded mt-1">{triggerHealthDetail.errorMessage}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold">All Trigger Health</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Checked</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Success</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failures</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {allHealth.map((trigger) => (
                      <tr key={trigger.triggerId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trigger.provider}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trigger.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(trigger.status)}`}>
                            {trigger.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {trigger.lastCheckedAt ? new Date(trigger.lastCheckedAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {trigger.lastSuccessAt ? new Date(trigger.lastSuccessAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trigger.consecutiveFailures}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedTriggerId(trigger.triggerId)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {selectedView === 'alerts' && alertsData && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">All Alerts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alertsData.alerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No alerts
                    </td>
                  </tr>
                ) : (
                  alertsData.alerts.map((alert) => (
                    <tr key={alert.id} className={alert.resolved ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{alert.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{alert.triggerId.substring(0, 8)}...</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{alert.message}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {alert.resolved ? (
                          <span className="text-green-600">Resolved</span>
                        ) : (
                          <span className="text-red-600">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {!alert.resolved && (
                          <button
                            onClick={() => {
                              if (confirm('Mark this alert as resolved?')) {
                                resolveAlertMutation.mutate(alert.id);
                              }
                            }}
                            disabled={resolveAlertMutation.isPending}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {resolveAlertMutation.isPending ? 'Resolving...' : 'Resolve'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metrics Tab */}
      {selectedView === 'metrics' && metricsData && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Detailed Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="text-sm text-gray-600">Total Triggers</div>
                <div className="text-3xl font-bold text-gray-900">{metricsData.totalTriggers}</div>
              </div>
              <div className="border-l-4 border-green-500 pl-4">
                <div className="text-sm text-gray-600">Active Triggers</div>
                <div className="text-3xl font-bold text-green-600">{metricsData.activeTriggers}</div>
              </div>
              <div className="border-l-4 border-green-500 pl-4">
                <div className="text-sm text-gray-600">Healthy Triggers</div>
                <div className="text-3xl font-bold text-green-600">{metricsData.healthyTriggers}</div>
              </div>
              <div className="border-l-4 border-red-500 pl-4">
                <div className="text-sm text-gray-600">Unhealthy Triggers</div>
                <div className="text-3xl font-bold text-red-600">{metricsData.unhealthyTriggers}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-md font-semibold mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-gray-600">Emails Processed</div>
                <div className="text-2xl font-semibold text-gray-900">{metricsData.totalEmailsProcessed.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Workflows Triggered</div>
                <div className="text-2xl font-semibold text-gray-900">{metricsData.totalWorkflowsTriggered.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Avg Poll Interval</div>
                <div className="text-2xl font-semibold text-gray-900">{metricsData.averagePollInterval}s</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Token Refresh Failures</div>
                <div className="text-2xl font-semibold text-red-600">{metricsData.tokenRefreshFailures}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-md font-semibold mb-4">Triggers by Provider</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(metricsData.triggersByProvider).map(([provider, count]) => (
                <div key={provider} className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 capitalize">{provider}</div>
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                </div>
              ))}
              {Object.keys(metricsData.triggersByProvider).length === 0 && (
                <div className="col-span-4 text-center text-gray-500 py-4">No provider data available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

