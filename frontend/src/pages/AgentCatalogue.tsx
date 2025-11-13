import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import api from '../lib/api';

interface AgentFramework {
  name: string;
  displayName: string;
  description: string;
  type: string;
  version: string;
  capabilities: {
    supportsRecursivePlanning: boolean;
    supportsMultiRole: boolean;
    supportsSelfHealing: boolean;
    supportsCollaboration: boolean;
    supportsToolUse: boolean;
    supportsMemory: boolean;
    maxIterations: number;
    estimatedLatencyMs: number;
    costPer1kTokens: number;
  };
  supportedFeatures: string[];
}

/**
 * Agent Catalogue
 * 
 * Searchable list of available agent frameworks
 * Features:
 * - Server-side search using /agents/frameworks/search
 * - View detailed framework information
 * - Compare frameworks side-by-side
 */
export default function AgentCatalogue() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedFrameworkDetail, setSelectedFrameworkDetail] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch all agent frameworks (for comparison and initial load)
  const { data: frameworksData, isLoading } = useQuery({
    queryKey: queryKeys.agentFrameworks.all,
    queryFn: async () => {
      const response = await api.get('/agents/frameworks');
      return response.data;
    },
  });

  // Fetch search results when there's a search query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['agentFrameworks', 'search', debouncedSearchQuery],
    queryFn: async () => {
      if (!debouncedSearchQuery.trim()) {
        return null;
      }
      const response = await api.get(`/agents/frameworks/search?q=${encodeURIComponent(debouncedSearchQuery)}`);
      return response.data;
    },
    enabled: debouncedSearchQuery.trim().length > 0,
  });

  // Fetch detailed framework information
  const { data: frameworkDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['agentFrameworks', 'detail', selectedFrameworkDetail],
    queryFn: async () => {
      if (!selectedFrameworkDetail) return null;
      const response = await api.get(`/agents/frameworks/${selectedFrameworkDetail}`);
      return response.data;
    },
    enabled: !!selectedFrameworkDetail,
  });

  const allFrameworks: AgentFramework[] = frameworksData?.frameworks || [];
  
  // Use search results if available, otherwise use all frameworks with client-side filtering
  const filteredFrameworks = useMemo(() => {
    if (debouncedSearchQuery.trim() && searchResults?.frameworks) {
      return searchResults.frameworks;
    }
    
    // Fallback to client-side filtering if no search query
    if (!searchQuery.trim()) {
      return allFrameworks;
    }
    
    // Client-side filtering for instant feedback while debouncing
    const query = searchQuery.toLowerCase();
    return allFrameworks.filter((framework) => {
      return (
        framework.displayName.toLowerCase().includes(query) ||
        framework.description.toLowerCase().includes(query) ||
        framework.type.toLowerCase().includes(query) ||
        framework.supportedFeatures.some((feature) => feature.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, debouncedSearchQuery, searchResults, allFrameworks]);

  // Toggle framework selection for comparison
  const toggleFrameworkSelection = (frameworkName: string) => {
    setSelectedFrameworks((prev) => {
      if (prev.includes(frameworkName)) {
        return prev.filter((name) => name !== frameworkName);
      } else if (prev.length < 3) {
        // Limit to 3 frameworks for comparison
        return [...prev, frameworkName];
      }
      return prev;
    });
  };

  // Get selected frameworks for comparison (use all frameworks to get full data)
  const selectedFrameworkData = allFrameworks.filter((f) => selectedFrameworks.includes(f.name));

  const handleViewDetails = (frameworkName: string) => {
    setSelectedFrameworkDetail(frameworkName);
  };

  const handleCloseDetail = () => {
    setSelectedFrameworkDetail(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in p-6">
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">Agent Catalogue</h1>
        <p className="text-gray-600 dark:text-gray-400">Browse and compare available agent frameworks</p>
      </div>

      {/* Search and Filter */}
      <div className="mb-6">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search frameworks by name, description, or features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 placeholder-gray-400 dark:placeholder-gray-500"
            />
            {(isSearching || (searchQuery && searchQuery !== debouncedSearchQuery)) && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
              </div>
            )}
          </div>
          {selectedFrameworks.length > 0 && (
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
            >
              {showComparison ? 'Hide' : 'Show'} Comparison ({selectedFrameworks.length})
            </button>
          )}
        </div>
        {debouncedSearchQuery && searchResults && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Found {searchResults.frameworks?.length || 0} framework{searchResults.frameworks?.length !== 1 ? 's' : ''} matching "{debouncedSearchQuery}"
          </p>
        )}
      </div>

      {/* Comparison View */}
      {showComparison && selectedFrameworkData.length > 0 && (
        <div className="mb-6 bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Framework Comparison</h2>
          <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-2 text-gray-900 dark:text-gray-100">Feature</th>
                    {selectedFrameworkData.map((framework) => (
                      <th key={framework.name} className="text-left p-2 text-gray-900 dark:text-gray-100">
                        {framework.displayName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Type</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.type}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Version</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.version}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Recursive Planning</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.capabilities.supportsRecursivePlanning ? '✅' : '❌'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Multi-Role</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.capabilities.supportsMultiRole ? '✅' : '❌'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Self-Healing</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.capabilities.supportsSelfHealing ? '✅' : '❌'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Collaboration</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.capabilities.supportsCollaboration ? '✅' : '❌'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Tool Use</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.capabilities.supportsToolUse ? '✅' : '❌'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Memory</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.capabilities.supportsMemory ? '✅' : '❌'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Max Iterations</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.capabilities.maxIterations}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Est. Latency (ms)</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        {framework.capabilities.estimatedLatencyMs}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold text-gray-700 dark:text-gray-300">Cost per 1k Tokens</td>
                    {selectedFrameworkData.map((framework) => (
                      <td key={framework.name} className="p-2 text-gray-700 dark:text-gray-300">
                        ${framework.capabilities.costPer1kTokens.toFixed(4)}
                      </td>
                    ))}
                  </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Framework List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading frameworks...</p>
        </div>
      ) : filteredFrameworks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No frameworks found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFrameworks.map((framework) => (
            <div
              key={framework.name}
              className={`bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl shadow-sm p-6 border-2 ${
                selectedFrameworks.includes(framework.name)
                  ? 'border-indigo-500 dark:border-indigo-400'
                  : 'border-transparent'
              } hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 cursor-pointer" onClick={() => handleViewDetails(framework.name)}>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    {framework.displayName}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{framework.type}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(framework.name);
                    }}
                    className="px-3 py-1 rounded text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                  >
                    Details
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFrameworkSelection(framework.name);
                    }}
                    className={`px-3 py-1 rounded text-sm transition-all ${
                      selectedFrameworks.includes(framework.name)
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {selectedFrameworks.includes(framework.name) ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-4">{framework.description}</p>

              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">Capabilities:</h4>
                <div className="flex flex-wrap gap-2">
                  {framework.capabilities.supportsRecursivePlanning && (
                    <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400 rounded text-xs">
                      Recursive Planning
                    </span>
                  )}
                  {framework.capabilities.supportsMultiRole && (
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400 rounded text-xs">
                      Multi-Role
                    </span>
                  )}
                  {framework.capabilities.supportsSelfHealing && (
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-400 rounded text-xs">
                      Self-Healing
                    </span>
                  )}
                  {framework.capabilities.supportsCollaboration && (
                    <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-400 rounded text-xs">
                      Collaboration
                    </span>
                  )}
                  {framework.capabilities.supportsToolUse && (
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 rounded text-xs">
                      Tool Use
                    </span>
                  )}
                  {framework.capabilities.supportsMemory && (
                    <span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-400 rounded text-xs">
                      Memory
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Max Iterations:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">{framework.capabilities.maxIterations}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Latency:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">{framework.capabilities.estimatedLatencyMs}ms</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Cost:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">
                      ${framework.capabilities.costPer1kTokens.toFixed(4)}/1k
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Version:</span>
                    <span className="ml-2 font-semibold text-gray-900 dark:text-gray-100">{framework.version}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-gray-100">Supported Features:</h4>
                <div className="flex flex-wrap gap-1">
                  {framework.supportedFeatures.slice(0, 5).map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                    >
                      {feature.replace(/-/g, ' ')}
                    </span>
                  ))}
                  {framework.supportedFeatures.length > 5 && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                      +{framework.supportedFeatures.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Framework Detail Modal */}
      {selectedFrameworkDetail && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={handleCloseDetail}>
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isLoadingDetail ? 'Loading...' : frameworkDetail?.framework?.displayName || selectedFrameworkDetail}
              </h2>
              <button
                onClick={handleCloseDetail}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {isLoadingDetail ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : frameworkDetail?.framework ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Description</h3>
                    <p className="text-gray-900 dark:text-gray-100">{frameworkDetail.framework.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Type</h3>
                      <p className="text-gray-900 dark:text-gray-100">{frameworkDetail.framework.type}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Version</h3>
                      <p className="text-gray-900 dark:text-gray-100">{frameworkDetail.framework.version}</p>
                    </div>
                  </div>

                  {frameworkDetail.framework.capabilities && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">Capabilities</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Recursive Planning</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {frameworkDetail.framework.capabilities.supportsRecursivePlanning ? '✅ Yes' : '❌ No'}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Multi-Role</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {frameworkDetail.framework.capabilities.supportsMultiRole ? '✅ Yes' : '❌ No'}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Self-Healing</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {frameworkDetail.framework.capabilities.supportsSelfHealing ? '✅ Yes' : '❌ No'}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Collaboration</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {frameworkDetail.framework.capabilities.supportsCollaboration ? '✅ Yes' : '❌ No'}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Tool Use</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {frameworkDetail.framework.capabilities.supportsToolUse ? '✅ Yes' : '❌ No'}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Memory</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {frameworkDetail.framework.capabilities.supportsMemory ? '✅ Yes' : '❌ No'}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Max Iterations</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {frameworkDetail.framework.capabilities.maxIterations}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Est. Latency</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {frameworkDetail.framework.capabilities.estimatedLatencyMs}ms
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Cost per 1k Tokens</div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            ${frameworkDetail.framework.capabilities.costPer1kTokens.toFixed(4)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {frameworkDetail.framework.supportedFeatures && frameworkDetail.framework.supportedFeatures.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">Supported Features</h3>
                      <div className="flex flex-wrap gap-2">
                        {frameworkDetail.framework.supportedFeatures.map((feature: string) => (
                          <span
                            key={feature}
                            className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 rounded-lg text-sm"
                          >
                            {feature.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">Failed to load framework details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

