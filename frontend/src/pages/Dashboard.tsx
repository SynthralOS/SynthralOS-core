import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { Link } from 'react-router-dom';
import SparklineChart from '../components/SparklineChart';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats,
    queryFn: async () => {
      const response = await api.get('/stats');
      return {
        totalWorkflows: response.data.totalWorkflows || 0,
        executionsToday: response.data.executionsToday || 0,
        successRate: response.data.successRate || 0,
      };
    },
    staleTime: 30000,
  });

  const loading = isLoading;

  // Fetch trend data from API
  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.stats, 'trends'],
    queryFn: async () => {
      const response = await api.get('/stats/trends');
      return response.data;
    },
    staleTime: 60000, // 1 minute
  });

  const { resolvedTheme } = useTheme();
  
  // Fetch chart data from API
  const { data: executionTrendData, isLoading: chartLoading } = useQuery({
    queryKey: [...queryKeys.dashboard.stats, 'chart'],
    queryFn: async () => {
      const response = await api.get('/stats/chart');
      return response.data;
    },
    staleTime: 60000, // 1 minute
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in">
      {/* Hero Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's what's happening with your workflows.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Workflows Card */}
        <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1 animate-slide-up">
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 dark:from-indigo-900/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Workflows
              </h3>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 dark:from-indigo-900/50 to-indigo-50 dark:to-indigo-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
            
            {/* Value */}
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
                {loading ? (
                  <span className="inline-block w-16 h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : (
                  stats?.totalWorkflows || 0
                )}
              </span>
            </div>
            
            {/* Trend */}
            {trendsLoading ? (
              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                {trends?.totalWorkflows && (
                  <>
                    <div className={`flex items-center gap-1 font-medium ${
                      trends.totalWorkflows.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 
                      trends.totalWorkflows.direction === 'down' ? 'text-red-600 dark:text-red-400' : 
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {trends.totalWorkflows.direction !== 'neutral' && (
                        <svg className={`w-4 h-4 ${trends.totalWorkflows.direction === 'down' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      )}
                      <span>
                        {trends.totalWorkflows.direction !== 'neutral' && (trends.totalWorkflows.direction === 'up' ? '+' : '-')}
                        {trends.totalWorkflows.value.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400">vs last month</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Executions Today Card */}
        <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-blue-300/50 dark:hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 dark:from-blue-900/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Executions Today
              </h3>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 dark:from-blue-900/50 to-blue-50 dark:to-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
                {loading ? (
                  <span className="inline-block w-16 h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : (
                  stats?.executionsToday || 0
                )}
              </span>
            </div>
            
            {trendsLoading ? (
              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                {trends?.executionsToday && (
                  <>
                    <div className={`flex items-center gap-1 font-medium ${
                      trends.executionsToday.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 
                      trends.executionsToday.direction === 'down' ? 'text-red-600 dark:text-red-400' : 
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {trends.executionsToday.direction !== 'neutral' && (
                        <svg className={`w-4 h-4 ${trends.executionsToday.direction === 'down' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      )}
                      <span>
                        {trends.executionsToday.direction !== 'neutral' && (trends.executionsToday.direction === 'up' ? '+' : '-')}
                        {trends.executionsToday.value.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400">vs yesterday</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Success Rate Card */}
        <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-xl hover:border-emerald-300/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 dark:from-emerald-900/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Success Rate
              </h3>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-100 dark:from-emerald-900/50 to-emerald-50 dark:to-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
                {loading ? (
                  <span className="inline-block w-16 h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : stats && stats.successRate > 0 ? (
                  `${stats.successRate}%`
                ) : (
                  '-'
                )}
              </span>
            </div>
            
            {trendsLoading ? (
              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                {trends?.successRate && (
                  <>
                    <div className={`flex items-center gap-1 font-medium ${
                      trends.successRate.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 
                      trends.successRate.direction === 'down' ? 'text-red-600 dark:text-red-400' : 
                      'text-gray-500 dark:text-gray-400'
                    }`}>
                      {trends.successRate.direction !== 'neutral' && (
                        <svg className={`w-4 h-4 ${trends.successRate.direction === 'down' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      )}
                      <span>
                        {trends.successRate.direction !== 'neutral' && (trends.successRate.direction === 'up' ? '+' : '-')}
                        {trends.successRate.value.toFixed(1)}%
                      </span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400">vs last week</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="relative">
            <h3 className="text-xs font-semibold text-indigo-100 uppercase tracking-wider mb-4">
              Quick Actions
            </h3>
            
            <div className="space-y-2">
              <Link
                to="/dashboard/workflows/new"
                className="block w-full px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
              >
                Create Workflow
              </Link>
              <Link
                to="/dashboard/agents/copilot"
                className="block w-full px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
              >
                Chat with Agent
              </Link>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 blur-2xl" />
        </div>
      </div>

      {/* Execution Trends Chart */}
      <div className="mb-8">
        <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg hover:border-indigo-300/50 dark:hover:border-indigo-500/50 transition-all duration-300">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Execution Trends</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Workflow executions over the past week</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartLoading ? [] : (executionTrendData || [])} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={resolvedTheme === 'dark' ? '#374151' : '#e5e7eb'} />
              <XAxis 
                dataKey="day" 
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
                  padding: '8px 12px',
                }}
                labelStyle={{ color: resolvedTheme === 'dark' ? '#9ca3af' : '#6b7280' }}
              />
              <Line 
                type="monotone" 
                dataKey="executions" 
                stroke="#6366f1" 
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6 }}
                isAnimationActive={true}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Workflows */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Workflows</h2>
            <Link to="/dashboard/workflows" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors duration-200">
              View all →
            </Link>
          </div>
          
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 dark:from-indigo-900/50 to-indigo-50 dark:to-indigo-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Workflow {i}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">2 hours ago</p>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                  Active
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">System Status</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-gray-600 dark:text-gray-400">All systems operational</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 transition-colors duration-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">API Services</span>
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Healthy</span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 transition-colors duration-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Database</span>
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Healthy</span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 transition-colors duration-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Agent Services</span>
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Healthy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
