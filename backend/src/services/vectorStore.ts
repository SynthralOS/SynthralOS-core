// Vector store service with support for in-memory, database, and external providers (Pinecone, Weaviate, Chroma)

import { db, vectorIndexes, vectorDocuments } from '../config/database';
import { eq, and } from 'drizzle-orm';

// Simple logger for vector store operations
const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[VectorStore] ${message}`, data ? JSON.stringify(data) : '');
  },
  error: (message: string, error?: unknown) => {
    console.error(`[VectorStore] ERROR: ${message}`, error);
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[VectorStore] WARN: ${message}`, data ? JSON.stringify(data) : '');
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.DEBUG === 'true') {
      console.debug(`[VectorStore] DEBUG: ${message}`, data ? JSON.stringify(data) : '');
    }
  }
};

// Dynamic import for Pinecone to avoid errors if package is not installed
let Pinecone: any = null;
try {
  const pineconeModule = require('@pinecone-database/pinecone');
  Pinecone = pineconeModule.Pinecone || pineconeModule.default || pineconeModule;
} catch (error) {
  // Pinecone package not installed - will throw error when used
}

interface VectorDocument {
  id: string;
  embedding: number[];
  text: string;
  metadata?: Record<string, unknown>;
}

// In-memory vector store for development/testing
class InMemoryVectorStore {
  private stores: Map<string, VectorDocument[]> = new Map();

  async upsert(indexName: string, documents: Array<{ id?: string; embedding: number[]; text: string; metadata?: Record<string, unknown> }>): Promise<string[]> {
    if (!this.stores.has(indexName)) {
      this.stores.set(indexName, []);
    }

    const store = this.stores.get(indexName)!;
    const ids: string[] = [];

    for (const doc of documents) {
      const id = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const existingIndex = store.findIndex((d) => d.id === id);
      
      const vectorDoc: VectorDocument = {
        id,
        embedding: doc.embedding,
        text: doc.text,
        metadata: doc.metadata,
      };

      if (existingIndex >= 0) {
        store[existingIndex] = vectorDoc;
      } else {
        store.push(vectorDoc);
      }
      ids.push(id);
    }

    return ids;
  }

  async query(indexName: string, queryEmbedding: number[], topK: number = 5): Promise<Array<{ id: string; text: string; score: number; metadata?: Record<string, unknown> }>> {
    const store = this.stores.get(indexName) || [];
    
    // Calculate cosine similarity
    const results = store.map((doc) => {
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      return {
        id: doc.id,
        text: doc.text,
        score,
        metadata: doc.metadata,
      };
    });

    // Sort by score descending and return top K
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async delete(indexName: string, ids: string[]): Promise<void> {
    const store = this.stores.get(indexName);
    if (!store) return;

    const idSet = new Set(ids);
    const filtered = store.filter((doc) => !idSet.has(doc.id));
    this.stores.set(indexName, filtered);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Database-backed vector store with multi-tenant support
export class DatabaseVectorStore {
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async getOrCreateIndex(organizationId: string | null, indexName: string, provider: string = 'database'): Promise<string> {
    const startTime = Date.now();
    logger.debug('Getting or creating index', { organizationId, indexName, provider });

    try {
      // Find existing index
      const whereConditions = [eq(vectorIndexes.name, indexName)];
      if (organizationId) {
        whereConditions.push(eq(vectorIndexes.organizationId, organizationId));
      } else {
        whereConditions.push(eq(vectorIndexes.organizationId, null));
      }
      
      const existing = await db.select()
        .from(vectorIndexes)
        .where(whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0])
        .limit(1);

      if (existing.length > 0) {
        const duration = Date.now() - startTime;
        logger.debug('Index found', { indexId: existing[0].id, duration });
        return existing[0].id;
      }

      // Create new index
      const [newIndex] = await db.insert(vectorIndexes)
        .values({
          organizationId: organizationId || null,
          name: indexName,
          provider,
        })
        .returning({ id: vectorIndexes.id });

      const duration = Date.now() - startTime;
      logger.info('Index created', { indexId: newIndex.id, organizationId, indexName, provider, duration });
      return newIndex.id;
    } catch (error) {
      logger.error('Error getting or creating index', error);
      throw error;
    }
  }

  async upsert(
    organizationId: string | null,
    indexName: string,
    documents: Array<{ id?: string; embedding: number[]; text: string; metadata?: Record<string, unknown> }>
  ): Promise<string[]> {
    const startTime = Date.now();
    logger.info('Upserting documents', { 
      organizationId, 
      indexName, 
      documentCount: documents.length 
    });

    try {
      const indexId = await this.getOrCreateIndex(organizationId, indexName, 'database');
      const ids: string[] = [];
      let created = 0;
      let updated = 0;

      for (const doc of documents) {
        const id = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Check if document exists
        const existing = await db.select()
          .from(vectorDocuments)
          .where(eq(vectorDocuments.id, id))
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db.update(vectorDocuments)
            .set({
              text: doc.text,
              embedding: doc.embedding,
              metadata: doc.metadata || null,
              updatedAt: new Date(),
            })
            .where(eq(vectorDocuments.id, id));
          updated++;
        } else {
          // Insert new
          await db.insert(vectorDocuments)
            .values({
              id,
              indexId,
              organizationId: organizationId || null,
              text: doc.text,
              embedding: doc.embedding,
              metadata: doc.metadata || null,
            });
          created++;
        }
        ids.push(id);
      }

      const duration = Date.now() - startTime;
      logger.info('Documents upserted', { 
        organizationId, 
        indexName, 
        total: documents.length, 
        created, 
        updated, 
        duration 
      });

      return ids;
    } catch (error) {
      logger.error('Error upserting documents', error);
      throw error;
    }
  }

  async query(
    organizationId: string | null,
    indexName: string,
    queryEmbedding: number[],
    topK: number = 5
  ): Promise<Array<{ id: string; text: string; score: number; metadata?: Record<string, unknown> }>> {
    const startTime = Date.now();
    logger.debug('Querying vectors', { 
      organizationId, 
      indexName, 
      topK, 
      embeddingDimensions: queryEmbedding.length 
    });

    try {
      const indexId = await this.getOrCreateIndex(organizationId, indexName, 'database');

      // Get all documents for this index
      const whereConditions = [eq(vectorDocuments.indexId, indexId)];
      if (organizationId) {
        whereConditions.push(eq(vectorDocuments.organizationId, organizationId));
      } else {
        whereConditions.push(eq(vectorDocuments.organizationId, null));
      }
      
      const docs = await db.select()
        .from(vectorDocuments)
        .where(whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0]);

      logger.debug('Documents retrieved for similarity calculation', { 
        documentCount: docs.length 
      });

      // Calculate cosine similarity for all documents
      const results = docs.map((doc) => {
        const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
        return {
          id: doc.id,
          text: doc.text,
          score,
          metadata: (doc.metadata || {}) as Record<string, unknown>,
        };
      });

      // Sort by score descending and return top K
      const topResults = results.sort((a, b) => b.score - a.score).slice(0, topK);
      
      const duration = Date.now() - startTime;
      logger.info('Query completed', { 
        organizationId, 
        indexName, 
        totalDocuments: docs.length, 
        resultsReturned: topResults.length, 
        topK, 
        duration,
        avgScore: topResults.length > 0 ? topResults.reduce((sum, r) => sum + r.score, 0) / topResults.length : 0
      });

      return topResults;
    } catch (error) {
      logger.error('Error querying vectors', error);
      throw error;
    }
  }

  async delete(organizationId: string | null, indexName: string, ids: string[]): Promise<void> {
    const startTime = Date.now();
    logger.info('Deleting documents', { 
      organizationId, 
      indexName, 
      documentCount: ids.length 
    });

    try {
      const indexId = await this.getOrCreateIndex(organizationId, indexName, 'database');

      const deleteConditions = [eq(vectorDocuments.indexId, indexId)];
      if (organizationId) {
        deleteConditions.push(eq(vectorDocuments.organizationId, organizationId));
      } else {
        deleteConditions.push(eq(vectorDocuments.organizationId, null));
      }
      
      const result = await db.delete(vectorDocuments)
        .where(deleteConditions.length > 1 ? and(...deleteConditions) : deleteConditions[0]);

      const duration = Date.now() - startTime;
      logger.info('Documents deleted', { 
        organizationId, 
        indexName, 
        requestedCount: ids.length, 
        duration 
      });
    } catch (error) {
      logger.error('Error deleting documents', error);
      throw error;
    }
  }
}

// Pinecone vector store
class PineconeVectorStore {
  private client: any = null;
  private initialized = false;

  private async initialize(apiKey: string, environment?: string) {
    if (this.initialized && this.client) return;

    if (!Pinecone) {
      throw new Error('Pinecone package not installed. Please install it: npm install @pinecone-database/pinecone');
    }

    this.client = new Pinecone({
      apiKey,
      ...(environment && { environment }),
    });
    this.initialized = true;
  }

  async upsert(
    indexName: string,
    documents: Array<{ id?: string; embedding: number[]; text: string; metadata?: Record<string, unknown> }>,
    apiKey: string,
    environment?: string
  ): Promise<string[]> {
    await this.initialize(apiKey, environment);
    if (!this.client) throw new Error('Pinecone client not initialized');

    const index = this.client.index(indexName);
    const ids: string[] = [];

    // Prepare vectors for upsert
    const vectors = documents.map((doc) => {
      const id = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      ids.push(id);
      return {
        id,
        values: doc.embedding,
        metadata: {
          text: doc.text,
          ...(doc.metadata || {}),
        },
      };
    });

    // Upsert in batches of 100 (Pinecone limit)
    for (let i = 0; i < vectors.length; i += 100) {
      const batch = vectors.slice(i, i + 100);
      await index.upsert(batch);
    }

    return ids;
  }

  async query(
    indexName: string,
    queryEmbedding: number[],
    topK: number = 5,
    apiKey: string,
    environment?: string
  ): Promise<Array<{ id: string; text: string; score: number; metadata?: Record<string, unknown> }>> {
    await this.initialize(apiKey, environment);
    if (!this.client) throw new Error('Pinecone client not initialized');

    const index = this.client.index(indexName);
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    return queryResponse.matches.map((match: any) => ({
      id: match.id,
      text: (match.metadata?.text as string) || '',
      score: match.score || 0,
      metadata: (match.metadata || {}) as Record<string, unknown>,
    }));
  }

  async delete(
    indexName: string,
    ids: string[],
    apiKey: string,
    environment?: string
  ): Promise<void> {
    await this.initialize(apiKey, environment);
    if (!this.client) throw new Error('Pinecone client not initialized');

    const index = this.client.index(indexName);
    await index.deleteMany(ids);
  }
}

const inMemoryStore = new InMemoryVectorStore();
const databaseStore = new DatabaseVectorStore();
const pineconeStore = new PineconeVectorStore();

export async function storeVectors(
  provider: string,
  indexName: string,
  documents: Array<{ id?: string; embedding: number[]; text: string; metadata?: Record<string, unknown> }>,
  apiKey?: string,
  organizationId?: string | null
): Promise<string[]> {
  if (provider === 'memory') {
    return inMemoryStore.upsert(indexName || 'default', documents);
  } else if (provider === 'database') {
    return databaseStore.upsert(organizationId || null, indexName || 'default', documents);
  } else if (provider === 'pinecone') {
    if (!apiKey) {
      throw new Error('Pinecone API key is required');
    }
    return pineconeStore.upsert(indexName || 'default', documents, apiKey);
  } else if (provider === 'weaviate') {
    throw new Error('Weaviate support requires weaviate-ts-client package. Please install it: npm install weaviate-ts-client');
  } else if (provider === 'chroma') {
    throw new Error('Chroma support requires chromadb package. Please install it: npm install chromadb');
  } else {
    throw new Error(`Unsupported vector store provider: ${provider}`);
  }
}

export async function queryVectors(
  provider: string,
  indexName: string,
  queryEmbedding: number[],
  topK: number = 5,
  apiKey?: string,
  organizationId?: string | null
): Promise<Array<{ id: string; text: string; score: number; metadata?: Record<string, unknown> }>> {
  if (provider === 'memory') {
    return inMemoryStore.query(indexName || 'default', queryEmbedding, topK);
  } else if (provider === 'database') {
    return databaseStore.query(organizationId || null, indexName || 'default', queryEmbedding, topK);
  } else if (provider === 'pinecone') {
    if (!apiKey) {
      throw new Error('Pinecone API key is required');
    }
    return pineconeStore.query(indexName || 'default', queryEmbedding, topK, apiKey);
  } else if (provider === 'weaviate') {
    throw new Error('Weaviate support requires weaviate-ts-client package');
  } else if (provider === 'chroma') {
    throw new Error('Chroma support requires chromadb package');
  } else {
    throw new Error(`Unsupported vector store provider: ${provider}`);
  }
}

export async function deleteVectors(
  provider: string,
  indexName: string,
  ids: string[],
  apiKey?: string,
  organizationId?: string | null
): Promise<void> {
  if (provider === 'memory') {
    return inMemoryStore.delete(indexName || 'default', ids);
  } else if (provider === 'database') {
    return databaseStore.delete(organizationId || null, indexName || 'default', ids);
  } else if (provider === 'pinecone') {
    if (!apiKey) {
      throw new Error('Pinecone API key is required');
    }
    return pineconeStore.delete(indexName || 'default', ids, apiKey);
  } else if (provider === 'weaviate') {
    throw new Error('Weaviate support requires weaviate-ts-client package');
  } else if (provider === 'chroma') {
    throw new Error('Chroma support requires chromadb package');
  } else {
    throw new Error(`Unsupported vector store provider: ${provider}`);
  }
}
