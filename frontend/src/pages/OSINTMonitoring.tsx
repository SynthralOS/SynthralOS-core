import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { useTheme } from '../contexts/ThemeContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import ChartCard from '../components/ChartCard';

interface OSINTMonitor {
  id: string;
  name: string;
  description?: string;
  source: 'twitter' | 'reddit' | 'news' | 'forums' | 'github' | 'linkedin' | 'youtube' | 'web';
  status: 'active' | 'paused' | 'error' | 'disabled';
  config: Record<string, any>;
  schedule?: Record<string, any>;
  filters?: Record<string, any>;
  workflowId?: string;
  alertId?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastError?: string;
  errorCount: number;
  resultCount: number;
  createdAt: string;
  updatedAt: string;
}

interface OSINTResult {
  id: string;
  monitorId: string;
  source: string;
  sourceId: string;
  title?: string;
  content: string;
  url?: string;
  author?: string;
  authorUrl?: string;
  publishedAt: string;
  collectedAt: string;
  metadata?: Record<string, any>;
  sentiment?: string;
  sentimentScore?: number;
  tags?: string[];
  processed: boolean;
}

interface OSINTStats {
  monitors: {
    total: number;
    active: number;
  };
  results: {
    total: number;
    bySource: Record<string, number>;
  };
}

export default function OSINTMonitoring() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [selectedView, setSelectedView] = useState<'overview' | 'monitors' | 'results'>('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<OSINTMonitor | null>(null);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);

  const { data: monitors = [], isLoading: monitorsLoading } = useQuery<OSINTMonitor[]>({
    queryKey: queryKeys.osint.monitors,
    queryFn: async () => {
      const response = await api.get('/osint/monitors');
      return response.data;
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<OSINTStats>({
    queryKey: queryKeys.osint.stats,
    queryFn: async () => {
      const response = await api.get('/osint/stats');
      return response.data;
    },
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery<{
    results: OSINTResult[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  }>({
    queryKey: queryKeys.osint.results(selectedMonitorId || undefined),
    queryFn: async () => {
      if (selectedMonitorId) {
        const response = await api.get(`/osint/monitors/${selectedMonitorId}/results?limit=50`);
        return response.data;
      }
      const response = await api.get('/osint/results?limit=50');
      return response.data;
    },
    enabled: selectedView === 'results',
  });

  const triggerMutation = useMutation({
    mutationFn: async (monitorId: string) => {
      await api.post(`/osint/monitors/${monitorId}/trigger`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.osint.monitors });
      queryClient.invalidateQueries({ queryKey: queryKeys.osint.stats });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (monitorId: string) => {
      await api.delete(`/osint/monitors/${monitorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.osint.monitors });
      queryClient.invalidateQueries({ queryKey: queryKeys.osint.stats });
    },
  });

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      twitter: '#1DA1F2',
      reddit: '#FF4500',
      news: '#FF6B6B',
      forums: '#4ECDC4',
      github: '#333',
      linkedin: '#0077B5',
      youtube: '#FF0000',
      web: '#6366f1',
    };
    return colors[source] || '#6b7280';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
      case 'paused':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'error':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'disabled':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
  };

  // Prepare chart data
  const sourceDistributionData = stats?.results?.bySource
    ? Object.entries(stats.results.bySource).map(([source, count]) => ({
        name: source.charAt(0).toUpperCase() + source.slice(1),
        value: count,
        color: getSourceColor(source),
      }))
    : [];

  const resultsByDate = resultsData?.results.reduce((acc: Record<string, number>, result) => {
    const date = new Date(result.collectedAt).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {}) || {};

  const resultsTrendData = Object.entries(resultsByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7); // Last 7 days

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
            OSINT / Social Monitoring
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor social media, news, forums, and web sources for keywords and mentions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
        >
          + Create Monitor
        </button>
      </div>

      {/* Stats Overview */}
      {statsLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm p-8 mb-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="ml-3 text-gray-600 dark:text-gray-400">Loading stats...</p>
          </div>
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 animate-slide-up">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Monitors</div>
            <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
              {stats.monitors.total}
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg hover:border-emerald-300/50 dark:hover:border-emerald-500/50 transition-all duration-300 animate-slide-up">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Active Monitors</div>
            <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
              {stats.monitors.active}
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 animate-slide-up">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Total Results</div>
            <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
              {stats.results.total.toLocaleString()}
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg hover:border-purple-300/50 dark:hover:border-purple-500/50 transition-all duration-300 animate-slide-up">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Sources</div>
            <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
              {Object.keys(stats.results.bySource || {}).length}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ChartCard title="Results by Source" description="Distribution of collected results across sources">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sourceDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sourceDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#ffffff',
                    border: `1px solid ${resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Results Trend" description="Results collected over the past 7 days">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={resultsTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  dataKey="date" 
                  stroke={resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280'}
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke={resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280'}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: resolvedTheme === 'dark' ? '#1f2937' : '#ffffff',
                    border: `1px solid ${resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200/50 dark:border-gray-700/50 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'monitors', label: 'Monitors' },
            { id: 'results', label: 'Results' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedView(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                selectedView === tab.id
                  ? 'border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content based on selected view */}
      {selectedView === 'monitors' && (
        <div className="space-y-4">
          {monitorsLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="ml-3 text-gray-600 dark:text-gray-400">Loading monitors...</p>
              </div>
            </div>
          ) : monitors.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">No monitors configured</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Create your first OSINT monitor to start collecting data</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                >
                  Create Monitor
                </button>
              </div>
            </div>
          ) : (
            monitors.map((monitor, index) => (
              <div
                key={monitor.id}
                className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${getSourceColor(monitor.source)}20` }}
                      >
                        <span className="text-lg font-bold" style={{ color: getSourceColor(monitor.source) }}>
                          {monitor.source.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{monitor.name}</h3>
                        {monitor.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{monitor.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(monitor.status)}`}>
                        {monitor.status}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                        {monitor.source}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {monitor.resultCount} results
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => triggerMutation.mutate(monitor.id)}
                      disabled={triggerMutation.isPending}
                      className="px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors duration-200 font-medium"
                    >
                      Trigger
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMonitor(monitor);
                        setShowCreateModal(true);
                      }}
                      className="px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors duration-200 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMonitorId(monitor.id);
                        setSelectedView('results');
                      }}
                      className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 font-medium"
                    >
                      View Results
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this monitor?')) {
                          deleteMutation.mutate(monitor.id);
                        }
                      }}
                      className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedView === 'results' && (
        <div className="space-y-4">
          {resultsLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="ml-3 text-gray-600 dark:text-gray-400">Loading results...</p>
              </div>
            </div>
          ) : !resultsData || resultsData.results.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">No results found</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">Results will appear here once monitors start collecting data</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {resultsData.results.map((result, index) => (
                <div
                  key={result.id}
                  className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${getSourceColor(result.source)}20` }}
                        >
                          <span className="text-sm font-bold" style={{ color: getSourceColor(result.source) }}>
                            {result.source.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {result.title && (
                          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{result.title}</h4>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">{result.content}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        {result.author && (
                          <span>By {result.author}</span>
                        )}
                        <span>{new Date(result.publishedAt).toLocaleDateString()}</span>
                        {result.sentiment && (
                          <span className={`px-2 py-1 rounded-full ${
                            result.sentiment === 'positive' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                            result.sentiment === 'negative' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                            'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {result.sentiment}
                          </span>
                        )}
                      </div>
                    </div>
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors duration-200 font-medium"
                      >
                        View Source
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Monitor Modal */}
      {showCreateModal && (
        <CreateMonitorModal
          monitor={selectedMonitor}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedMonitor(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setSelectedMonitor(null);
            queryClient.invalidateQueries({ queryKey: queryKeys.osint.monitors });
            queryClient.invalidateQueries({ queryKey: queryKeys.osint.stats });
          }}
        />
      )}
    </div>
  );
}

// Create/Edit Monitor Modal Component
function CreateMonitorModal({
  monitor,
  onClose,
  onSave,
}: {
  monitor?: OSINTMonitor | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [formData, setFormData] = useState({
    name: monitor?.name || '',
    description: monitor?.description || '',
    source: monitor?.source || 'reddit' as OSINTMonitor['source'],
    status: monitor?.status || 'active' as OSINTMonitor['status'],
    keywords: (monitor?.config?.keywords as string[]) || [],
    keywordInput: '',
    // Source-specific configs
    subreddits: (monitor?.config?.subreddits as string[]) || [],
    subredditInput: '',
    twitterQuery: monitor?.config?.twitterQuery || '',
    newsSources: (monitor?.config?.sources as string[]) || [],
    newsSourceInput: '',
    githubRepos: (monitor?.config?.repos as string[]) || [],
    githubRepoInput: '',
    webUrls: (monitor?.config?.urls as string[]) || [],
    webUrlInput: '',
    // Schedule
    scheduleInterval: (monitor?.schedule as { interval?: number })?.interval || 60,
    // Filters
    enableSentiment: monitor?.filters ? !!(monitor.filters as { enableSentiment?: boolean })?.enableSentiment : false,
    sentimentFilter: (monitor?.filters as { sentiment?: string })?.sentiment || 'any',
    languageFilter: (monitor?.filters as { language?: string })?.language || '',
    // Workflow/Alert
    workflowId: monitor?.workflowId || '',
    alertId: monitor?.alertId || '',
  });

  // Fetch workflows and alerts for dropdowns
  const { data: workflows = [] } = useQuery({
    queryKey: queryKeys.workflows.all,
    queryFn: async () => {
      const response = await api.get('/workflows');
      return response.data;
    },
  });

  const { data: alerts = [] } = useQuery({
    queryKey: queryKeys.alerts.all,
    queryFn: async () => {
      const response = await api.get('/alerts');
      return response.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const config: Record<string, any> = {
        keywords: data.keywords,
      };

      // Source-specific config
      switch (data.source) {
        case 'reddit':
          config.subreddits = data.subreddits;
          break;
        case 'twitter':
          config.twitterQuery = data.twitterQuery;
          break;
        case 'news':
          config.sources = data.newsSources;
          break;
        case 'github':
          config.repos = data.githubRepos;
          break;
        case 'web':
          config.urls = data.webUrls;
          break;
      }

      const schedule = {
        interval: data.scheduleInterval, // in minutes
      };

      const filters: Record<string, any> = {};
      if (data.enableSentiment) {
        filters.enableSentiment = true;
        if (data.sentimentFilter !== 'any') {
          filters.sentiment = data.sentimentFilter;
        }
      }
      if (data.languageFilter) {
        filters.language = data.languageFilter;
      }

      const payload = {
        name: data.name,
        description: data.description,
        source: data.source,
        status: data.status,
        config,
        schedule,
        filters: Object.keys(filters).length > 0 ? filters : null,
        workflowId: data.workflowId || null,
        alertId: data.alertId || null,
      };

      if (monitor) {
        await api.put(`/osint/monitors/${monitor.id}`, payload);
      } else {
        await api.post('/osint/monitors', payload);
      }
    },
    onSuccess: () => {
      onSave();
    },
    onError: (error: any) => {
      console.error('Failed to save monitor:', error);
      alert(`Failed to save monitor: ${error.response?.data?.error || error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.keywords.length === 0) {
      alert('Please add at least one keyword');
      return;
    }
    saveMutation.mutate(formData);
  };

  const addKeyword = () => {
    if (formData.keywordInput.trim()) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, formData.keywordInput.trim()],
        keywordInput: '',
      });
    }
  };

  const removeKeyword = (index: number) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter((_, i) => i !== index),
    });
  };

  const addSubreddit = () => {
    if (formData.subredditInput.trim()) {
      setFormData({
        ...formData,
        subreddits: [...formData.subreddits, formData.subredditInput.trim().replace(/^r\//, '')],
        subredditInput: '',
      });
    }
  };

  const removeSubreddit = (index: number) => {
    setFormData({
      ...formData,
      subreddits: formData.subreddits.filter((_, i) => i !== index),
    });
  };

  const addNewsSource = () => {
    if (formData.newsSourceInput.trim()) {
      setFormData({
        ...formData,
        newsSources: [...formData.newsSources, formData.newsSourceInput.trim()],
        newsSourceInput: '',
      });
    }
  };

  const removeNewsSource = (index: number) => {
    setFormData({
      ...formData,
      newsSources: formData.newsSources.filter((_, i) => i !== index),
    });
  };

  const addGithubRepo = () => {
    if (formData.githubRepoInput.trim()) {
      setFormData({
        ...formData,
        githubRepos: [...formData.githubRepos, formData.githubRepoInput.trim()],
        githubRepoInput: '',
      });
    }
  };

  const removeGithubRepo = (index: number) => {
    setFormData({
      ...formData,
      githubRepos: formData.githubRepos.filter((_, i) => i !== index),
    });
  };

  const addWebUrl = () => {
    if (formData.webUrlInput.trim()) {
      setFormData({
        ...formData,
        webUrls: [...formData.webUrls, formData.webUrlInput.trim()],
        webUrlInput: '',
      });
    }
  };

  const removeWebUrl = (index: number) => {
    setFormData({
      ...formData,
      webUrls: formData.webUrls.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {monitor ? 'Edit OSINT Monitor' : 'Create OSINT Monitor'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 text-2xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                placeholder="e.g., Monitor Reddit for AI discussions"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                rows={3}
                placeholder="Describe what this monitor does..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Source *
                </label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value as OSINTMonitor['source'] })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                  required
                >
                  <option value="reddit">Reddit</option>
                  <option value="twitter">Twitter/X</option>
                  <option value="news">News</option>
                  <option value="github">GitHub</option>
                  <option value="web">Web</option>
                  <option value="forums">Forums</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as OSINTMonitor['status'] })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Keywords */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Keywords *</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.keywordInput}
                onChange={(e) => setFormData({ ...formData, keywordInput: e.target.value })}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                placeholder="Enter keyword and press Enter"
              />
              <button
                type="button"
                onClick={addKeyword}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => removeKeyword(index)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Source-Specific Configuration */}
          {formData.source === 'reddit' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Subreddits</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.subredditInput}
                  onChange={(e) => setFormData({ ...formData, subredditInput: e.target.value })}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSubreddit();
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                  placeholder="Enter subreddit name (e.g., technology or r/technology)"
                />
                <button
                  type="button"
                  onClick={addSubreddit}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.subreddits.map((subreddit, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium"
                  >
                    r/{subreddit}
                    <button
                      type="button"
                      onClick={() => removeSubreddit(index)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {formData.source === 'twitter' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Twitter Query</h3>
              <input
                type="text"
                value={formData.twitterQuery}
                onChange={(e) => setFormData({ ...formData, twitterQuery: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                placeholder="e.g., AI OR artificial intelligence lang:en"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Use Twitter search syntax. Keywords will be combined with this query.
              </p>
            </div>
          )}

          {formData.source === 'news' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">News Sources</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.newsSourceInput}
                  onChange={(e) => setFormData({ ...formData, newsSourceInput: e.target.value })}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addNewsSource();
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                  placeholder="Enter news source name or URL"
                />
                <button
                  type="button"
                  onClick={addNewsSource}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.newsSources.map((source, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium"
                  >
                    {source}
                    <button
                      type="button"
                      onClick={() => removeNewsSource(index)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {formData.source === 'github' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">GitHub Repositories</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.githubRepoInput}
                  onChange={(e) => setFormData({ ...formData, githubRepoInput: e.target.value })}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addGithubRepo();
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                  placeholder="e.g., owner/repo"
                />
                <button
                  type="button"
                  onClick={addGithubRepo}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.githubRepos.map((repo, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium"
                  >
                    {repo}
                    <button
                      type="button"
                      onClick={() => removeGithubRepo(index)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {formData.source === 'web' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Web URLs</h3>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={formData.webUrlInput}
                  onChange={(e) => setFormData({ ...formData, webUrlInput: e.target.value })}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addWebUrl();
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                  placeholder="https://example.com"
                />
                <button
                  type="button"
                  onClick={addWebUrl}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.webUrls.map((url, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium"
                  >
                    {url}
                    <button
                      type="button"
                      onClick={() => removeWebUrl(index)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Schedule</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Polling Interval (minutes)
              </label>
              <input
                type="number"
                value={formData.scheduleInterval}
                onChange={(e) => setFormData({ ...formData, scheduleInterval: parseInt(e.target.value) || 60 })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                min={1}
                max={1440}
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                How often to check for new content (1-1440 minutes)
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enableSentiment"
                checked={formData.enableSentiment}
                onChange={(e) => setFormData({ ...formData, enableSentiment: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="enableSentiment" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Sentiment Analysis
              </label>
            </div>

            {formData.enableSentiment && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Sentiment Filter
                </label>
                <select
                  value={formData.sentimentFilter}
                  onChange={(e) => setFormData({ ...formData, sentimentFilter: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                >
                  <option value="any">Any Sentiment</option>
                  <option value="positive">Positive Only</option>
                  <option value="negative">Negative Only</option>
                  <option value="neutral">Neutral Only</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Language Filter (ISO 639-1 code, e.g., en, es, fr)
              </label>
              <input
                type="text"
                value={formData.languageFilter}
                onChange={(e) => setFormData({ ...formData, languageFilter: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
                placeholder="e.g., en"
              />
            </div>
          </div>

          {/* Workflow/Alert Integration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Automation</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Trigger Workflow (Optional)
              </label>
              <select
                value={formData.workflowId}
                onChange={(e) => setFormData({ ...formData, workflowId: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
              >
                <option value="">None</option>
                {workflows.map((workflow: any) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Trigger Alert (Optional)
              </label>
              <select
                value={formData.alertId}
                onChange={(e) => setFormData({ ...formData, alertId: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 dark:focus:border-indigo-500/50 transition-all duration-200 text-gray-900 dark:text-gray-100"
              >
                <option value="">None</option>
                {alerts.map((alert: any) => (
                  <option key={alert.id} value={alert.id}>
                    {alert.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
            >
              {saveMutation.isPending ? 'Saving...' : monitor ? 'Update Monitor' : 'Create Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

