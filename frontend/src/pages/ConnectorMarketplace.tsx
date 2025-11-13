import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, CheckCircle, XCircle, Plug2, Database, MessageSquare, ShoppingCart, Briefcase, Mail } from 'lucide-react';

interface Connector {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  oauthProvider?: string;
  auth: {
    type: string;
    scopes?: string[];
  };
  actions: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

interface ConnectionStatus {
  [connectorId: string]: {
    connected: boolean;
    connectedAt?: string;
  };
}

const categoryIcons: Record<string, any> = {
  crm: Briefcase,
  communication: MessageSquare,
  database: Database,
  productivity: Briefcase,
  'e-commerce': ShoppingCart,
  data: Database,
};

const categoryColors: Record<string, string> = {
  crm: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
  communication: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
  database: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
  productivity: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
  'e-commerce': 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200',
  data: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
};

export default function ConnectorMarketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<ConnectionStatus>({});

  // Fetch connectors from backend
  const { data: connectors = [], isLoading } = useQuery<Connector[]>({
    queryKey: ['connectors'],
    queryFn: async () => {
      const token = localStorage.getItem('clerk_session');
      const response = await fetch('/api/connectors', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch connectors');
      return response.json();
    },
  });

  // Fetch connection statuses
  const { data: connections = [] } = useQuery({
    queryKey: ['connector-connections'],
    queryFn: async () => {
      const token = localStorage.getItem('clerk_session');
      const response = await fetch('/api/connectors/connections', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  useEffect(() => {
    // Map connections to status object
    const statusMap: ConnectionStatus = {};
    connections.forEach((conn: any) => {
      statusMap[conn.connectorId] = {
        connected: true,
        connectedAt: conn.connectedAt,
      };
    });
    setConnectionStatuses(statusMap);
  }, [connections]);

  // Get unique categories
  const categories = Array.from(new Set(connectors.map((c) => c.category)));

  // Filter connectors
  const filteredConnectors = connectors.filter((connector) => {
    const matchesSearch =
      connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      connector.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === null || connector.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleConnect = async (connectorId: string, oauthProvider?: string) => {
    try {
      const token = localStorage.getItem('clerk_session');
      const response = await fetch(`/api/connectors/${connectorId}/connect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.authUrl) {
        // Redirect to OAuth flow
        window.location.href = data.authUrl;
      } else if (data.requiresManualSetup) {
        // Show modal or redirect to settings
        alert(`Please configure ${connectorId} credentials in settings. Auth type: ${data.authType}`);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to initiate connection');
    }
  };

  const handleDisconnect = async (connectorId: string) => {
    if (!confirm('Are you sure you want to disconnect this connector?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('clerk_session');
      const response = await fetch(`/api/connectors/${connectorId}/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) throw new Error('Failed to disconnect');
      
      setConnectionStatuses((prev) => ({
        ...prev,
        [connectorId]: { connected: false },
      }));
      
      // Refetch connections
      window.location.reload();
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert('Failed to disconnect');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Connector Marketplace</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Discover and connect to 20+ integrations to automate your workflows
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search connectors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {categories.map((category) => {
            const Icon = categoryIcons[category] || Plug2;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {filteredConnectors.length} connector{filteredConnectors.length !== 1 ? 's' : ''} found
      </div>

      {/* Connector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredConnectors.map((connector) => {
          const Icon = categoryIcons[connector.category] || Plug2;
          const isConnected = connectionStatuses[connector.id]?.connected || false;
          const categoryColor = categoryColors[connector.category] || categoryColors.data;

          return (
            <div
              key={connector.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
            >
              {/* Connector Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${categoryColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{connector.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${categoryColor}`}>
                      {connector.category}
                    </span>
                  </div>
                </div>
                {isConnected && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {connector.description}
              </p>

              {/* Actions Count */}
              <div className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                {connector.actions.length} action{connector.actions.length !== 1 ? 's' : ''} available
              </div>

              {/* Connect Button */}
              <div className="flex gap-2">
                {isConnected ? (
                  <>
                    <button
                      onClick={() => handleDisconnect(connector.id)}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(connector.id, connector.oauthProvider)}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plug2 className="w-4 h-4" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredConnectors.length === 0 && (
        <div className="text-center py-12">
          <Plug2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No connectors found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
}

