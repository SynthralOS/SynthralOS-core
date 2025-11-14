import { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { getNodeDefinition } from '../lib/nodes/nodeRegistry';
import api from '../lib/api';
import { CodeEditor } from './CodeEditor';
import { useQuery } from '@tanstack/react-query';

interface NodeConfigPanelProps {
  node: Node | null;
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
}

export default function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [retry, setRetry] = useState<Record<string, unknown>>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  // Fetch code agents for hook selection
  const { data: codeAgents } = useQuery({
    queryKey: ['code-agents'],
    queryFn: async () => {
      const response = await api.get('/code-agents');
      return response.data;
    },
    enabled: node?.data?.type === 'ai.rag' || node?.data?.type === 'ai.document_ingest',
  });

  useEffect(() => {
    if (node) {
      setConfig(node.data.config || {});
      setRetry((node.data.retry as Record<string, unknown>) || { enabled: false, maxAttempts: 3, backoff: 'exponential', delay: 1000 });
      
      // Check if email trigger node has credentials
      const nodeType = node.data.type as string;
      if (nodeType?.startsWith('trigger.email.')) {
        const credentials = (config.credentials as Record<string, unknown>) || {};
        if (credentials.accessToken) {
          setConnectionStatus('connected');
        } else {
          setConnectionStatus('idle');
        }
      }
    }
  }, [node, config]);

  if (!node) return null;

  const nodeDef = getNodeDefinition(node.data.type);
  if (!nodeDef || !nodeDef.config) {
    return (
      <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Node Configuration</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">No configuration available for this node.</p>
      </div>
    );
  }

  const handleChange = (key: string, value: unknown) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(node.id, { ...node.data, config: newConfig });
  };

  const handleRetryChange = (key: string, value: unknown) => {
    const newRetry = { ...retry, [key]: value };
    setRetry(newRetry);
    onUpdate(node.id, { ...node.data, retry: newRetry });
  };

  const handleConnectOAuth = async (provider: 'gmail' | 'outlook') => {
    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');

      // Get OAuth authorization URL
      const response = await api.get(`/email-oauth/${provider}/authorize`);
      const { authUrl } = response.data;

      // Store node ID and provider in sessionStorage for callback
      sessionStorage.setItem('oauth_node_id', node.id);
      sessionStorage.setItem('oauth_provider', provider);

      // Open OAuth window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const oauthWindow = window.open(
        authUrl,
        'OAuth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      // Listen for OAuth callback via event and polling
      const handleOAuthEvent = (event: CustomEvent) => {
        if (event.detail.nodeId === node.id && event.detail.provider === provider) {
          clearInterval(checkOAuthCallback);
          window.removeEventListener('oauth-callback', handleOAuthEvent as EventListener);
          sessionStorage.removeItem(`oauth_${provider}_token`);
          handleOAuthCallback(event.detail.token, provider);
          if (oauthWindow) oauthWindow.close();
        }
      };

      window.addEventListener('oauth-callback', handleOAuthEvent as EventListener);

      const checkOAuthCallback = setInterval(() => {
        try {
          const token = sessionStorage.getItem(`oauth_${provider}_token`);
          if (token) {
            clearInterval(checkOAuthCallback);
            window.removeEventListener('oauth-callback', handleOAuthEvent as EventListener);
            sessionStorage.removeItem(`oauth_${provider}_token`);
            handleOAuthCallback(token, provider);
            if (oauthWindow) oauthWindow.close();
          }
        } catch (error) {
          console.error('Error checking OAuth callback:', error);
        }
      }, 500);

      // Cleanup after 10 minutes
      const cleanup = () => {
        clearInterval(checkOAuthCallback);
        window.removeEventListener('oauth-callback', handleOAuthEvent as EventListener);
        if (oauthWindow && !oauthWindow.closed) {
          oauthWindow.close();
        }
        setIsConnecting(false);
        setConnectionStatus('idle');
      };

      setTimeout(cleanup, 10 * 60 * 1000);
    } catch (error: any) {
      console.error('Error initiating OAuth:', error);
      setConnectionStatus('error');
      setIsConnecting(false);
      alert(`Failed to connect ${provider}: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleOAuthCallback = async (token: string, provider: 'gmail' | 'outlook') => {
    try {
      // Retrieve credentials from backend using secure token
      const response = await api.get(`/email-oauth/retrieve/${token}`);
      const { credentials, email } = response.data;

      // Update node config with credentials and email
      const newConfig = {
        ...config,
        credentials,
        email: email || config.email,
      };

      setConfig(newConfig);
      onUpdate(node.id, { ...node.data, config: newConfig });
      setConnectionStatus('connected');
      setIsConnecting(false);
    } catch (error: any) {
      console.error('Error retrieving OAuth credentials:', error);
      setConnectionStatus('error');
      setIsConnecting(false);
      alert(`Failed to retrieve credentials: ${error.response?.data?.error || error.message}`);
    }
  };

  const renderInput = (key: string, property: any) => {
    const value = config[key] ?? property.default ?? '';

    // Special handling for hook fields (preIngestHook, postAnswerHook)
    if (key === 'preIngestHook' || key === 'postAnswerHook') {
      return (
        <div className="space-y-2">
          <select
            value={value as string || ''}
            onChange={(e) => handleChange(key, e.target.value || undefined)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            <option value="">None (no hook)</option>
            {codeAgents?.map((agent: any) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.language}) - v{agent.version}
              </option>
            ))}
          </select>
          {property.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
          )}
        </div>
      );
    }

    switch (property.type) {
      case 'string':
        if (property.enum) {
          return (
            <select
              value={value as string}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              {property.enum.map((opt: unknown) => (
                <option key={String(opt)} value={String(opt)}>
                  {String(opt)}
                </option>
              ))}
            </select>
          );
        }
        // Use Monaco editor for code format
        if (property.format === 'code') {
          // Determine language from node type or property
          let language: 'javascript' | 'python' | 'typescript' | 'bash' = 'javascript';
          const nodeType = node?.data?.type as string;
          if (nodeType === 'action.code.python') {
            language = 'python';
          } else if (property.language === 'python') {
            language = 'python';
          } else if (property.language === 'typescript') {
            language = 'typescript';
          } else if (property.language === 'bash') {
            language = 'bash';
          }
          
          return (
            <div className="space-y-2">
              <CodeEditor
                language={language}
                value={value as string || ''}
                onChange={(val) => handleChange(key, val)}
                height="300px"
                placeholder={property.description}
              />
              {property.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{property.description}</p>
              )}
            </div>
          );
        }
        return (
          <textarea
            value={value as string}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder={property.description}
            rows={3}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
          />
        );

      case 'array':
        // Handle array inputs (e.g., Switch cases, packages)
        if (property.format === 'packages') {
          // Packages: one per line
          const packagesArray = Array.isArray(value) ? value : [];
          const packagesText = packagesArray.join('\n');
          return (
            <div className="space-y-2">
              <textarea
                value={packagesText}
                onChange={(e) => {
                  const lines = e.target.value.split('\n').filter(line => line.trim());
                  handleChange(key, lines);
                }}
                placeholder="pandas&#10;numpy&#10;requests"
                rows={4}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">Enter one package per line (e.g., pandas, numpy)</p>
            </div>
          );
        }
        // Default: JSON array
        return (
          <div className="space-y-2">
            <textarea
              value={JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleChange(key, parsed);
                } catch {
                  // Invalid JSON, keep as string for now
                }
              }}
              placeholder={property.description || 'Enter JSON array'}
              rows={6}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">Enter as JSON array</p>
          </div>
        );

      case 'number':
        return (
          <div className="space-y-1">
            <input
              type="number"
              value={value as number}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              min={property.minimum}
              max={property.maximum}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            {property.minimum !== undefined && property.maximum !== undefined && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Range: {property.minimum} - {property.maximum} ms
              </p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => handleChange(key, e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
          />
        );

      default:
        return (
          <input
            type="text"
            value={String(value)}
            onChange={(e) => handleChange(key, e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        );
    }
  };

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configure Node</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{nodeDef.name}</p>
        {nodeDef.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{nodeDef.description}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* OAuth Connection Section for Email Triggers */}
        {(node.data.type as string)?.startsWith('trigger.email.gmail') && (
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Gmail Connection</h4>
            {connectionStatus === 'connected' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <span>✓</span>
                  <span>Connected to {(config.email as string) || 'Gmail'}</span>
                </div>
                <button
                  onClick={() => handleConnectOAuth('gmail')}
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Reconnect Gmail
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnectOAuth('gmail')}
                disabled={isConnecting}
                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Gmail'}
              </button>
            )}
            {connectionStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">Connection failed. Please try again.</p>
            )}
          </div>
        )}

        {(node.data.type as string)?.startsWith('trigger.email.outlook') && (
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Outlook Connection</h4>
            {connectionStatus === 'connected' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <span>✓</span>
                  <span>Connected to {(config.email as string) || 'Outlook'}</span>
                </div>
                <button
                  onClick={() => handleConnectOAuth('outlook')}
                  className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Reconnect Outlook
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnectOAuth('outlook')}
                disabled={isConnecting}
                className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect Outlook'}
              </button>
            )}
            {connectionStatus === 'error' && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">Connection failed. Please try again.</p>
            )}
          </div>
        )}

        {/* Web Scrape Node - Grouped Sections */}
        {(node.data.type as string) === 'action.web_scrape' && (
          <>
            {/* Basic Configuration */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Basic Configuration</h4>
              {Object.entries(nodeDef.config.properties)
                .filter(([key]) => ['url', 'selectors', 'extractText', 'extractHtml', 'extractAttributes'].includes(key))
                .map(([key, property]) => {
                  if (key === 'selectors') {
                    const selectors = (config.selectors as Record<string, string>) || {};
                    const selectorEntries = Object.entries(selectors);
                    
                    return (
                      <div key={key} className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {key}
                          {nodeDef.config?.required?.includes(key) && (
                            <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                          )}
                        </label>
                        {property.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{property.description}</p>
                        )}
                        <div className="space-y-2">
                          {selectorEntries.map(([fieldName, selector], index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Field name (e.g., title)"
                                value={fieldName}
                                onChange={(e) => {
                                  const newSelectors = { ...selectors };
                                  delete newSelectors[fieldName];
                                  newSelectors[e.target.value] = selector;
                                  handleChange('selectors', newSelectors);
                                }}
                                className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
                              />
                              <input
                                type="text"
                                placeholder="CSS selector (e.g., h1.title)"
                                value={selector}
                                onChange={(e) => {
                                  const newSelectors = { ...selectors };
                                  newSelectors[fieldName] = e.target.value;
                                  handleChange('selectors', newSelectors);
                                }}
                                className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm font-mono"
                              />
                              <button
                                onClick={() => {
                                  const newSelectors = { ...selectors };
                                  delete newSelectors[fieldName];
                                  handleChange('selectors', newSelectors);
                                }}
                                className="px-2 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title="Remove selector"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newSelectors = { ...selectors, '': '' };
                              handleChange('selectors', newSelectors);
                            }}
                            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            + Add Selector
                          </button>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={key} className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {key}
                        {nodeDef.config?.required?.includes(key) && (
                          <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                        )}
                      </label>
                      {property.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                      )}
                      {renderInput(key, property)}
                    </div>
                  );
                })}
            </div>

            {/* JavaScript Rendering (Puppeteer) */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">JavaScript Rendering</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Enable for JavaScript-rendered content (SPAs, React, Vue, Angular). Auto-detected if not set.
              </p>
              {Object.entries(nodeDef.config.properties)
                .filter(([key]) => ['renderJavaScript', 'waitForSelector', 'waitForTimeout', 'executeJavaScript', 'scrollToBottom', 'viewport', 'screenshot'].includes(key))
                .map(([key, property]) => (
                  <div key={key} className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {key}
                    </label>
                    {property.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                    )}
                    {renderInput(key, property)}
                  </div>
                ))}
            </div>

            {/* Proxy Settings */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Proxy Settings</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Use proxy for requests to avoid rate limits and IP bans.
              </p>
              {Object.entries(nodeDef.config.properties)
                .filter(([key]) => ['useProxy', 'proxyOptions', 'proxyId'].includes(key))
                .map(([key, property]) => (
                  <div key={key} className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {key}
                    </label>
                    {property.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                    )}
                    {renderInput(key, property)}
                  </div>
                ))}
            </div>

            {/* Advanced Options */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Advanced Options</h4>
              {Object.entries(nodeDef.config.properties)
                .filter(([key]) => !['url', 'selectors', 'extractText', 'extractHtml', 'extractAttributes', 'renderJavaScript', 'waitForSelector', 'waitForTimeout', 'executeJavaScript', 'scrollToBottom', 'viewport', 'screenshot', 'useProxy', 'proxyOptions', 'proxyId'].includes(key))
                .map(([key, property]) => (
                  <div key={key} className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {key}
                      {nodeDef.config?.required?.includes(key) && (
                        <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                      )}
                    </label>
                    {property.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                    )}
                    {renderInput(key, property)}
                  </div>
                ))}
            </div>
          </>
        )}

        {/* Other Nodes - Standard Configuration */}
        {(node.data.type as string) !== 'action.web_scrape' && (
          <>
            {Object.entries(nodeDef.config.properties).map(([key, property]) => {
              // Skip credentials field for email triggers (handled by OAuth)
              if (key === 'credentials' && (node.data.type as string)?.startsWith('trigger.email.')) {
                return null;
              }
              
              return (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {key}
                    {nodeDef.config?.required?.includes(key) && (
                      <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                    )}
                  </label>
                  {property.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{property.description}</p>
                  )}
                  {renderInput(key, property)}
                </div>
              );
            })}
          </>
        )}

        {/* Breakpoint Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Debug Settings</h4>
          
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(node.data.breakpoint as boolean) || false}
                  onChange={(e) => onUpdate(node.id, { ...node.data, breakpoint: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Breakpoint</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">Pause execution when this node is reached</p>
            </div>
          </div>
        </div>

        {/* Retry Settings Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Retry Settings</h4>
          
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(retry.enabled as boolean) || false}
                  onChange={(e) => handleRetryChange('enabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Retry</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">Automatically retry failed executions</p>
            </div>

            {(retry.enabled as boolean) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Attempts
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={(retry.maxAttempts as number) || 3}
                    onChange={(e) => handleRetryChange('maxAttempts', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum number of retry attempts (1-10)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Backoff Strategy
                  </label>
                  <select
                    value={(retry.backoff as string) || 'exponential'}
                    onChange={(e) => handleRetryChange('backoff', e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="exponential">Exponential (delay × 2^attempt)</option>
                    <option value="fixed">Fixed (constant delay)</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How delay increases between retries</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Delay (ms)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="60000"
                    step="100"
                    value={(retry.delay as number) || 1000}
                    onChange={(e) => handleRetryChange('delay', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Initial delay before first retry (100-60000ms)</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

