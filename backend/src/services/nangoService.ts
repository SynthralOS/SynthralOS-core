import { nangoClient } from '../config/nango';
import { db } from '../config/database';
import { connectorCredentials } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

/**
 * Nango Service
 * Handles OAuth flows and token management for third-party service integrations via Nango
 */

export interface NangoConnection {
  id: string;
  provider: string;
  userId: string;
  organizationId?: string;
  credentials: {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    [key: string]: unknown;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthInitiateResult {
  authUrl: string;
  state: string;
}

export class NangoService {
  /**
   * Check if Nango is available
   */
  private isAvailable(): boolean {
    return nangoClient !== null;
  }

  /**
   * Initiate OAuth flow for a provider
   * @param provider - The provider name (e.g., 'slack', 'salesforce')
   * @param userId - The user ID
   * @param organizationId - Optional organization ID
   * @param connectionId - Optional connection ID (for reconnection)
   * @returns OAuth authorization URL and state
   */
  async initiateOAuth(
    provider: string,
    userId: string,
    organizationId?: string,
    connectionId?: string
  ): Promise<OAuthInitiateResult> {
    if (!this.isAvailable()) {
      throw new Error('Nango is not configured. Please set NANGO_SECRET_KEY environment variable.');
    }

    try {
      // Generate a unique connection ID if not provided
      const finalConnectionId = connectionId || `${userId}-${provider}-${Date.now()}`;

      // Create OAuth link via Nango
      // Nango SDK method: getAuthUrl(provider, connectionId, params)
      const authUrl = await nangoClient!.getAuthUrl(
        provider,
        finalConnectionId,
        {
          user_id: userId,
          organization_id: organizationId,
        }
      );

      // Store connection metadata temporarily (Nango handles state internally)
      // We'll retrieve it in the callback using the connectionId
      return {
        authUrl,
        state: finalConnectionId,
      };
    } catch (error: any) {
      console.error(`[Nango] Error initiating OAuth for ${provider}:`, error);
      throw new Error(`Failed to initiate OAuth: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Handle OAuth callback and store credentials
   * @param provider - The provider name
   * @param connectionId - The connection ID from the OAuth flow
   * @param userId - The user ID
   * @param organizationId - Optional organization ID
   * @returns The stored connection
   */
  async handleCallback(
    provider: string,
    connectionId: string,
    userId: string,
    organizationId?: string
  ): Promise<NangoConnection> {
    if (!this.isAvailable()) {
      throw new Error('Nango is not configured. Please set NANGO_SECRET_KEY environment variable.');
    }

    try {
      // Get access token from Nango
      const connection = await nangoClient!.getConnection(provider, connectionId);

      if (!connection) {
        throw new Error('Connection not found. OAuth flow may have failed.');
      }

      // Extract credentials from Nango connection
      const credentials = {
        access_token: connection.credentials.access_token,
        refresh_token: connection.credentials.refresh_token,
        expires_at: connection.credentials.expires_at,
        // Include any additional metadata
        ...connection.credentials,
      };

      // Check if connection already exists in our database
      const [existing] = await db
        .select()
        .from(connectorCredentials)
        .where(
          and(
            eq(connectorCredentials.connectorId, provider),
            eq(connectorCredentials.userId, userId),
            organizationId ? eq(connectorCredentials.organizationId, organizationId) : undefined
          )
        )
        .limit(1);

      if (existing) {
        // Update existing connection
        const [updated] = await db
          .update(connectorCredentials)
          .set({
            credentials: credentials as any,
            updatedAt: new Date(),
          })
          .where(eq(connectorCredentials.id, existing.id))
          .returning();

        return {
          id: updated.id,
          provider,
          userId: updated.userId,
          organizationId: updated.organizationId || undefined,
          credentials: updated.credentials as any,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        };
      } else {
        // Create new connection
        const [newConnection] = await db
          .insert(connectorCredentials)
          .values({
            id: createId(),
            connectorId: provider,
            userId,
            organizationId: organizationId || null,
            credentials: credentials as any,
          })
          .returning();

        return {
          id: newConnection.id,
          provider,
          userId: newConnection.userId,
          organizationId: newConnection.organizationId || undefined,
          credentials: newConnection.credentials as any,
          createdAt: newConnection.createdAt,
          updatedAt: newConnection.updatedAt,
        };
      }
    } catch (error: any) {
      console.error(`[Nango] Error handling callback for ${provider}:`, error);
      throw new Error(`Failed to handle OAuth callback: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token for a connection
   * @param provider - The provider name
   * @param connectionId - The connection ID
   * @returns Updated credentials
   */
  async refreshToken(provider: string, connectionId: string): Promise<Record<string, unknown>> {
    if (!this.isAvailable()) {
      throw new Error('Nango is not configured. Please set NANGO_SECRET_KEY environment variable.');
    }

    try {
      // Nango handles token refresh automatically, but we can trigger it manually
      const connection = await nangoClient!.getConnection(provider, connectionId);

      if (!connection) {
        throw new Error('Connection not found');
      }

      // Update credentials in database
      const credentials = {
        access_token: connection.credentials.access_token,
        refresh_token: connection.credentials.refresh_token,
        expires_at: connection.credentials.expires_at,
        ...connection.credentials,
      };

      // Find and update the connection in our database
      const [existing] = await db
        .select()
        .from(connectorCredentials)
        .where(eq(connectorCredentials.connectorId, provider))
        .limit(1);

      if (existing) {
        await db
          .update(connectorCredentials)
          .set({
            credentials: credentials as any,
            updatedAt: new Date(),
          })
          .where(eq(connectorCredentials.id, existing.id));
      }

      return credentials;
    } catch (error: any) {
      console.error(`[Nango] Error refreshing token for ${provider}:`, error);
      throw new Error(`Failed to refresh token: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get access token for a connection
   * @param provider - The provider name
   * @param connectionId - The connection ID
   * @returns Access token
   */
  async getToken(provider: string, connectionId: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Nango is not configured. Please set NANGO_SECRET_KEY environment variable.');
    }

    try {
      const connection = await nangoClient!.getConnection(provider, connectionId);

      if (!connection) {
        throw new Error('Connection not found');
      }

      return connection.credentials.access_token as string;
    } catch (error: any) {
      console.error(`[Nango] Error getting token for ${provider}:`, error);
      throw new Error(`Failed to get token: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get all connections for a user/organization
   * @param userId - The user ID
   * @param organizationId - Optional organization ID
   * @returns List of connections
   */
  async getConnections(userId: string, organizationId?: string): Promise<NangoConnection[]> {
    const connections = await db
      .select()
      .from(connectorCredentials)
      .where(
        and(
          eq(connectorCredentials.userId, userId),
          organizationId ? eq(connectorCredentials.organizationId, organizationId) : undefined
        )
      );

    return connections.map((conn) => ({
      id: conn.id,
      provider: conn.connectorId,
      userId: conn.userId,
      organizationId: conn.organizationId || undefined,
      credentials: conn.credentials as any,
      createdAt: conn.createdAt,
      updatedAt: conn.updatedAt,
    }));
  }

  /**
   * Delete a connection
   * @param provider - The provider name
   * @param connectionId - The connection ID
   * @param userId - The user ID
   */
  async deleteConnection(provider: string, connectionId: string, userId: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Nango is not configured. Please set NANGO_SECRET_KEY environment variable.');
    }

    try {
      // Delete from Nango
      await nangoClient!.deleteConnection(provider, connectionId);

      // Delete from our database
      await db
        .delete(connectorCredentials)
        .where(
          and(
            eq(connectorCredentials.connectorId, provider),
            eq(connectorCredentials.userId, userId)
          )
        );
    } catch (error: any) {
      console.error(`[Nango] Error deleting connection for ${provider}:`, error);
      throw new Error(`Failed to delete connection: ${error.message || 'Unknown error'}`);
    }
  }
}

export const nangoService = new NangoService();

