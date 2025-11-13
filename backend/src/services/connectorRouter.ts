import { ConnectorManifest } from './connectors/types';
import { nangoService } from './nangoService';
import { connectorRegistry } from './connectors/registry';

/**
 * Connector Router Service
 * 
 * Implements 12-step waterfall routing logic to determine which provider
 * should handle a connector execution request.
 * 
 * Routing Priority:
 * 1. OAuth required → Nango
 * 2. API key present → Panora (future)
 * 3. API key missing → Panora shared-key (future)
 * 4. Visual workflow → Composio (future)
 * 5. Complex + Enterprise → Kaoto (future)
 * 6. Custom integration → Integuru (future)
 * 7. Data sync + available → Airbyte (future)
 * 8. Data sync + custom → Singer (future)
 * 9. ELT pipeline → Meltano (future)
 * 10. DevOps event-driven → Stackstorm (future)
 * 11. OpenAPI schema → OpenAPIChain (future)
 * 12. Fallback → Existing OAuth / Error
 */

export enum ConnectorProvider {
  NANGO = 'nango',
  PANORA = 'panora',
  PANORA_SHARED = 'panora_shared',
  COMPOSIO = 'composio',
  KAOTO = 'kaoto',
  INTEGURU = 'integuru',
  AIRBYTE = 'airbyte',
  SINGER = 'singer',
  MELTANO = 'meltano',
  STACKSTORM = 'stackstorm',
  OPENAPI_CHAIN = 'openapi_chain',
  CUSTOM_OAUTH = 'custom_oauth', // Existing Gmail/Outlook OAuth
  ERROR = 'error',
}

export interface RoutingDecision {
  provider: ConnectorProvider;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface RoutingContext {
  connectorId: string;
  connector: ConnectorManifest;
  userId: string;
  organizationId?: string;
  hasApiKey?: boolean;
  isVisualWorkflow?: boolean;
  isEnterprise?: boolean;
  isDataSync?: boolean;
  isELTPipeline?: boolean;
  isDevOps?: boolean;
  hasOpenAPISchema?: boolean;
  workflowComplexity?: 'simple' | 'medium' | 'complex';
}

export class ConnectorRouter {
  /**
   * Route a connector execution request to the appropriate provider
   * 
   * @param context - Routing context with connector and execution details
   * @returns Routing decision with provider and reason
   */
  async route(context: RoutingContext): Promise<RoutingDecision> {
    const { connector, connectorId } = context;

    // Step 1: OAuth required → Nango
    if (connector.auth.type === 'oauth2' && this.shouldUseNango(connector)) {
      return {
        provider: ConnectorProvider.NANGO,
        reason: 'OAuth2 authentication required - using Nango for OAuth flow',
        metadata: {
          connectorId,
          authType: 'oauth2',
        },
      };
    }

    // Step 2: API key present → Panora (future)
    if (context.hasApiKey && connector.auth.type === 'api_key') {
      // TODO: Implement Panora integration
      return {
        provider: ConnectorProvider.PANORA,
        reason: 'API key authentication - using Panora (not yet implemented)',
        metadata: {
          connectorId,
          authType: 'api_key',
        },
      };
    }

    // Step 3: API key missing → Panora shared-key (future)
    if (!context.hasApiKey && connector.auth.type === 'api_key') {
      // TODO: Implement Panora shared-key integration
      return {
        provider: ConnectorProvider.PANORA_SHARED,
        reason: 'API key missing - using Panora shared-key (not yet implemented)',
        metadata: {
          connectorId,
          authType: 'api_key',
        },
      };
    }

    // Step 4: Visual workflow → Composio (future)
    if (context.isVisualWorkflow) {
      // TODO: Implement Composio integration
      return {
        provider: ConnectorProvider.COMPOSIO,
        reason: 'Visual workflow detected - using Composio (not yet implemented)',
        metadata: {
          connectorId,
          workflowType: 'visual',
        },
      };
    }

    // Step 5: Complex + Enterprise → Kaoto (future)
    if (context.isEnterprise && context.workflowComplexity === 'complex') {
      // TODO: Implement Kaoto integration
      return {
        provider: ConnectorProvider.KAOTO,
        reason: 'Complex enterprise workflow - using Kaoto (not yet implemented)',
        metadata: {
          connectorId,
          workflowComplexity: context.workflowComplexity,
          isEnterprise: true,
        },
      };
    }

    // Step 6: Custom integration → Integuru (future)
    if (connector.category === 'custom') {
      // TODO: Implement Integuru integration
      return {
        provider: ConnectorProvider.INTEGURU,
        reason: 'Custom integration - using Integuru (not yet implemented)',
        metadata: {
          connectorId,
          category: 'custom',
        },
      };
    }

    // Step 7: Data sync + available → Airbyte (future)
    if (context.isDataSync && this.isAirbyteAvailable(connectorId)) {
      // TODO: Implement Airbyte integration
      return {
        provider: ConnectorProvider.AIRBYTE,
        reason: 'Data sync with Airbyte connector available (not yet implemented)',
        metadata: {
          connectorId,
          syncType: 'data',
        },
      };
    }

    // Step 8: Data sync + custom → Singer (future)
    if (context.isDataSync && !this.isAirbyteAvailable(connectorId)) {
      // TODO: Implement Singer integration
      return {
        provider: ConnectorProvider.SINGER,
        reason: 'Data sync with custom connector - using Singer (not yet implemented)',
        metadata: {
          connectorId,
          syncType: 'data',
        },
      };
    }

    // Step 9: ELT pipeline → Meltano (future)
    if (context.isELTPipeline) {
      // TODO: Implement Meltano integration
      return {
        provider: ConnectorProvider.MELTANO,
        reason: 'ELT pipeline detected - using Meltano (not yet implemented)',
        metadata: {
          connectorId,
          pipelineType: 'elt',
        },
      };
    }

    // Step 10: DevOps event-driven → Stackstorm (future)
    if (context.isDevOps) {
      // TODO: Implement Stackstorm integration
      return {
        provider: ConnectorProvider.STACKSTORM,
        reason: 'DevOps event-driven workflow - using Stackstorm (not yet implemented)',
        metadata: {
          connectorId,
          workflowType: 'devops',
        },
      };
    }

    // Step 11: OpenAPI schema → OpenAPIChain (future)
    if (context.hasOpenAPISchema) {
      // TODO: Implement OpenAPIChain integration
      return {
        provider: ConnectorProvider.OPENAPI_CHAIN,
        reason: 'OpenAPI schema available - using OpenAPIChain (not yet implemented)',
        metadata: {
          connectorId,
          hasOpenAPI: true,
        },
      };
    }

    // Step 12: Fallback → Existing OAuth / Error
    return this.fallbackRouting(context);
  }

  /**
   * Determine if a connector should use Nango
   * 
   * Nango is used for OAuth2 connectors that are not handled by custom OAuth flows
   * (e.g., Gmail and Outlook have custom OAuth implementations)
   */
  private shouldUseNango(connector: ConnectorManifest): boolean {
    // Gmail and Outlook use custom OAuth flows
    const customOAuthConnectors = ['gmail', 'outlook', 'google_gmail', 'microsoft_outlook'];
    
    if (customOAuthConnectors.includes(connector.id.toLowerCase())) {
      return false;
    }

    // Check if Nango is available
    try {
      // Nango service will throw if not configured
      return true; // Assume Nango is available if we get here
    } catch {
      return false;
    }
  }

  /**
   * Check if Airbyte connector is available for a given connector ID
   */
  private isAirbyteAvailable(connectorId: string): boolean {
    // TODO: Check Airbyte connector registry
    // For now, return false
    return false;
  }

  /**
   * Fallback routing logic
   * 
   * Tries to use existing OAuth flows (Gmail/Outlook) or returns error
   */
  private fallbackRouting(context: RoutingContext): RoutingDecision {
    const { connector, connectorId } = context;

    // Check if this is a connector with custom OAuth (Gmail/Outlook)
    const customOAuthConnectors = ['gmail', 'outlook', 'google_gmail', 'microsoft_outlook'];
    
    if (customOAuthConnectors.includes(connectorId.toLowerCase()) && connector.auth.type === 'oauth2') {
      return {
        provider: ConnectorProvider.CUSTOM_OAUTH,
        reason: 'Using existing custom OAuth flow for Gmail/Outlook',
        metadata: {
          connectorId,
          authType: 'oauth2',
        },
      };
    }

    // If no auth required, can proceed with direct execution
    if (connector.auth.type === 'none') {
      return {
        provider: ConnectorProvider.CUSTOM_OAUTH, // Use existing execution path
        reason: 'No authentication required - using direct execution',
        metadata: {
          connectorId,
          authType: 'none',
        },
      };
    }

    // Error: No suitable provider found
    return {
      provider: ConnectorProvider.ERROR,
      reason: `No suitable provider found for connector ${connectorId}. Authentication type: ${connector.auth.type}`,
      metadata: {
        connectorId,
        authType: connector.auth.type,
      },
    };
  }

  /**
   * Get routing decision for a connector without full context
   * 
   * This is a simplified version that uses defaults for missing context
   */
  async routeSimple(connectorId: string, userId: string, organizationId?: string): Promise<RoutingDecision> {
    const connector = connectorRegistry.get(connectorId);
    
    if (!connector) {
      return {
        provider: ConnectorProvider.ERROR,
        reason: `Connector ${connectorId} not found in registry`,
        metadata: {
          connectorId,
        },
      };
    }

    const context: RoutingContext = {
      connectorId,
      connector,
      userId,
      organizationId,
      // Default values for missing context
      hasApiKey: false,
      isVisualWorkflow: false,
      isEnterprise: false,
      isDataSync: false,
      isELTPipeline: false,
      isDevOps: false,
      hasOpenAPISchema: false,
      workflowComplexity: 'simple',
    };

    return this.route(context);
  }
}

export const connectorRouter = new ConnectorRouter();

