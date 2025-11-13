import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  organizationId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface AuditLogResponse {
  logs: AuditLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function AuditLogs() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [resourceIdFilter, setResourceIdFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);
  const limit = 50;

  const filters = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (actionFilter) params.append('action', actionFilter);
    if (resourceTypeFilter) params.append('resourceType', resourceTypeFilter);
    if (resourceIdFilter) params.append('resourceId', resourceIdFilter);
    if (userIdFilter) params.append('userId', userIdFilter);
    if (searchQuery) params.append('search', searchQuery);
    params.append('limit', limit.toString());
    params.append('offset', (page * limit).toString());
    return params.toString();
  }, [startDate, endDate, actionFilter, resourceTypeFilter, resourceIdFilter, userIdFilter, searchQuery, page, limit]);

  const { data, isLoading, error } = useQuery<AuditLogResponse>({
    queryKey: queryKeys.auditLogs.all(filters),
    queryFn: async () => {
      const response = await api.get(`/audit-logs?${filters}`);
      return response.data;
    },
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination;

  const { data: logDetail } = useQuery<AuditLog>({
    queryKey: showDetailModal ? queryKeys.auditLogs.detail(showDetailModal) : [''],
    queryFn: async () => {
      if (!showDetailModal) return null;
      const response = await api.get(`/audit-logs/${showDetailModal}`);
      return response.data;
    },
    enabled: !!showDetailModal,
  });

  const handleExportCsv = async () => {
    try {
      const exportParams = new URLSearchParams();
      if (startDate) exportParams.append('startDate', startDate);
      if (endDate) exportParams.append('endDate', endDate);
      if (actionFilter) exportParams.append('action', actionFilter);
      if (resourceTypeFilter) exportParams.append('resourceType', resourceTypeFilter);
      if (resourceIdFilter) exportParams.append('resourceId', resourceIdFilter);
      if (userIdFilter) exportParams.append('userId', userIdFilter);
      if (searchQuery) exportParams.append('search', searchQuery);
      exportParams.append('limit', '10000');

      const response = await api.get(`/audit-logs/export/csv?${exportParams.toString()}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `audit_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Failed to export audit logs: ${err.response?.data?.error || err.message}`);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('create')) return 'bg-green-100 text-green-800';
    if (action.includes('update')) return 'bg-blue-100 text-blue-800';
    if (action.includes('delete')) return 'bg-red-100 text-red-800';
    if (action.includes('login') || action.includes('logout')) return 'bg-purple-100 text-purple-800';
    if (action.includes('execute')) return 'bg-yellow-100 text-yellow-800';
    if (action.includes('read')) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setActionFilter('');
    setResourceTypeFilter('');
    setResourceIdFilter('');
    setUserIdFilter('');
    setSearchQuery('');
    setPage(0);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
        <p className="text-red-500 dark:text-red-400">Error loading audit logs: {(error as any).message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">Audit Logs</h1>
          <p className="text-gray-600 dark:text-gray-400">View and export audit trail of system activities</p>
        </div>
        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search across actions, resource types, and IDs..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(0);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(0);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(0);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="actionFilter" className="block text-sm font-medium text-gray-700 mb-1">
            Action
          </label>
          <input
            type="text"
            id="actionFilter"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            placeholder="e.g., workflow.create"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="resourceTypeFilter" className="block text-sm font-medium text-gray-700 mb-1">
            Resource Type
          </label>
          <input
            type="text"
            id="resourceTypeFilter"
            value={resourceTypeFilter}
            onChange={(e) => {
              setResourceTypeFilter(e.target.value);
              setPage(0);
            }}
            placeholder="e.g., workflow"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="resourceIdFilter" className="block text-sm font-medium text-gray-700 mb-1">
            Resource ID
          </label>
          <input
            type="text"
            id="resourceIdFilter"
            value={resourceIdFilter}
            onChange={(e) => {
              setResourceIdFilter(e.target.value);
              setPage(0);
            }}
            placeholder="e.g., workflow ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="userIdFilter" className="block text-sm font-medium text-gray-700 mb-1">
            User ID
          </label>
          <input
            type="text"
            id="userIdFilter"
            value={userIdFilter}
            onChange={(e) => {
              setUserIdFilter(e.target.value);
              setPage(0);
            }}
            placeholder="e.g., user ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Clear Filters Button */}
      {(startDate || endDate || actionFilter || resourceTypeFilter || resourceIdFilter || userIdFilter || searchQuery) && (
        <div className="mb-4">
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Results Count */}
      {pagination && (
        <div className="mb-4 text-sm text-gray-600">
          Showing {logs.length} of {pagination.total} audit logs
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <p>Loading audit logs...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500">No audit logs found for the selected filters.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP / User Agent
                  </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {log.userName || log.userEmail || log.userId || 'System'}
                        {log.userEmail && log.userName && (
                          <div className="text-xs text-gray-500">{log.userEmail}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <span className="font-medium">{log.resourceType}</span>
                        {log.resourceId && (
                          <div className="text-xs text-gray-500 font-mono">{log.resourceId}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.ipAddress && <div className="mb-1">IP: {log.ipAddress}</div>}
                      {log.userAgent && (
                        <div className="truncate max-w-xs text-xs" title={log.userAgent}>
                          {log.userAgent}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 hover:text-blue-800">View Details</summary>
                          <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto max-w-md">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setShowDetailModal(log.id)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        👁️ View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && (
            <div className="mt-6 flex justify-between items-center">
              <button
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {page + 1} of {Math.ceil(pagination.total / limit) || 1}
              </span>
              <button
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!pagination.hasMore}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Audit Log Detail Modal */}
      {showDetailModal && logDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Audit Log Details</h2>
              <button
                onClick={() => setShowDetailModal(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Log ID</label>
                <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded font-mono">{logDetail.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timestamp</label>
                <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                  {format(new Date(logDetail.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <p className="text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionBadgeColor(logDetail.action)}`}>
                    {logDetail.action}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resource Type</label>
                <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{logDetail.resourceType}</p>
              </div>
              {logDetail.resourceId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resource ID</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded font-mono">{logDetail.resourceId}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                  {logDetail.userName && <div className="font-medium">{logDetail.userName}</div>}
                  {logDetail.userEmail && <div className="text-gray-600">{logDetail.userEmail}</div>}
                  {logDetail.userId && <div className="text-xs text-gray-500 font-mono mt-1">ID: {logDetail.userId}</div>}
                  {!logDetail.userName && !logDetail.userEmail && !logDetail.userId && <div>System</div>}
                </div>
              </div>
              {logDetail.organizationId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded font-mono">{logDetail.organizationId}</p>
                </div>
              )}
              {logDetail.ipAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded font-mono">{logDetail.ipAddress}</p>
                </div>
              )}
              {logDetail.userAgent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Agent</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded break-all">{logDetail.userAgent}</p>
                </div>
              )}
              {logDetail.details && Object.keys(logDetail.details).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Details</label>
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto border border-gray-200">
                    {JSON.stringify(logDetail.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowDetailModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

