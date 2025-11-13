/**
 * Connector System Types
 * 
 * Defines the interface for the connector registry system
 */

export interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'communication' | 'data' | 'productivity' | 'ai' | 'custom';
  auth: {
    type: 'oauth2' | 'api_key' | 'basic' | 'none';
    scopes?: string[];
    authUrl?: string;
    tokenUrl?: string;
    clientId?: string;
    clientSecret?: string;
  };
  oauthProvider?: 'nango' | 'custom' | 'panora' | 'composio'; // Which OAuth provider to use
  actions: ConnectorAction[];
  triggers?: ConnectorTrigger[];
  icon?: string;
  documentationUrl?: string;
}

export interface ConnectorAction {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  outputSchema: Record<string, unknown>; // JSON Schema
}

export interface ConnectorTrigger {
  id: string;
  name: string;
  description: string;
  outputSchema: Record<string, unknown>; // JSON Schema
  webhookUrl?: string;
}

export interface ConnectorCredentials {
  id: string;
  userId: string;
  organizationId?: string;
  connectorId: string;
  credentials: Record<string, unknown>; // Encrypted
  expiresAt?: Date;
}

export interface ConnectorExecuteOptions {
  actionId: string;
  input: Record<string, unknown>;
  credentials: Record<string, unknown>;
}

export interface ConnectorExecuteResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: {
    message: string;
    code: string;
  };
}

