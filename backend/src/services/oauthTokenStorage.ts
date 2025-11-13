import crypto from 'crypto';

/**
 * Secure OAuth token storage for callback handling
 * Uses in-memory storage with expiration (in production, use Redis)
 */

interface StoredToken {
  credentials: Record<string, unknown>;
  email: string;
  userId: string;
  organizationId?: string;
  expiresAt: number;
}

class OAuthTokenStorage {
  private storage: Map<string, StoredToken> = new Map();
  private readonly TTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Store OAuth credentials temporarily
   * Returns a secure token that can be used to retrieve credentials
   */
  store(credentials: Record<string, unknown>, email: string, userId: string, organizationId?: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.TTL;

    this.storage.set(token, {
      credentials,
      email,
      userId,
      organizationId,
      expiresAt,
    });

    // Clean up expired entries periodically
    this.cleanup();

    return token;
  }

  /**
   * Retrieve and delete OAuth credentials
   * Returns null if token is invalid or expired
   */
  retrieve(token: string): StoredToken | null {
    const stored = this.storage.get(token);

    if (!stored) {
      return null;
    }

    // Check expiration
    if (Date.now() > stored.expiresAt) {
      this.storage.delete(token);
      return null;
    }

    // Delete token after retrieval (one-time use)
    this.storage.delete(token);

    return stored;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [token, stored] of this.storage.entries()) {
      if (now > stored.expiresAt) {
        this.storage.delete(token);
      }
    }
  }

  /**
   * Get storage size (for monitoring)
   */
  size(): number {
    return this.storage.size;
  }
}

export const oauthTokenStorage = new OAuthTokenStorage();

