/**
 * MongoDB Connector Executor
 * 
 * Executes MongoDB connector actions using direct database connection
 */

import { MongoClient, Db, Collection, Filter, Document } from 'mongodb';
import { NodeExecutionResult } from '@sos/shared';

interface MongoDBCredentials {
  connection_string: string;
  database?: string;
}

/**
 * Create MongoDB client and database connection
 */
async function createMongoDBConnection(credentials: MongoDBCredentials): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(credentials.connection_string);
  await client.connect();
  
  const dbName = credentials.database || new URL(credentials.connection_string).pathname.slice(1) || 'test';
  const db = client.db(dbName);
  
  return { client, db };
}

/**
 * Find documents in MongoDB collection
 */
export async function executeMongoDBFind(
  database: string,
  collection: string,
  filter: Filter<Document> = {},
  limit?: number,
  credentials: MongoDBCredentials
): Promise<NodeExecutionResult> {
  let client: MongoClient | null = null;
  
  try {
    const { client: mongoClient, db } = await createMongoDBConnection(credentials);
    client = mongoClient;
    
    const targetDb = database ? mongoClient.db(database) : db;
    const coll: Collection<Document> = targetDb.collection(collection);
    
    let query = coll.find(filter);
    if (limit) {
      query = query.limit(limit);
    }
    
    const documents = await query.toArray();

    return {
      success: true,
      output: {
        documents,
        count: documents.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'MongoDB find failed',
        code: 'MONGODB_FIND_ERROR',
        details: {
          code: error.code,
        },
      },
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * Insert document into MongoDB collection
 */
export async function executeMongoDBInsert(
  database: string,
  collection: string,
  document: Document,
  credentials: MongoDBCredentials
): Promise<NodeExecutionResult> {
  let client: MongoClient | null = null;
  
  try {
    const { client: mongoClient, db } = await createMongoDBConnection(credentials);
    client = mongoClient;
    
    const targetDb = database ? mongoClient.db(database) : db;
    const coll: Collection<Document> = targetDb.collection(collection);
    
    const result = await coll.insertOne(document);

    return {
      success: true,
      output: {
        insertedId: result.insertedId.toString(),
        acknowledged: result.acknowledged,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'MongoDB insert failed',
        code: 'MONGODB_INSERT_ERROR',
        details: {
          code: error.code,
        },
      },
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * Execute MongoDB connector action
 */
export async function executeMongoDB(
  actionId: string,
  input: Record<string, unknown>,
  credentials: MongoDBCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'find':
      const database = input.database as string;
      const collection = input.collection as string;
      
      if (!database || !collection) {
        return {
          success: false,
          error: {
            message: 'database and collection are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeMongoDBFind(
        database,
        collection,
        input.filter as Filter<Document> | undefined,
        input.limit as number | undefined,
        credentials
      );

    case 'insert':
      const insertDatabase = input.database as string;
      const insertCollection = input.collection as string;
      const document = input.document as Document;
      
      if (!insertDatabase || !insertCollection || !document) {
        return {
          success: false,
          error: {
            message: 'database, collection, and document are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeMongoDBInsert(
        insertDatabase,
        insertCollection,
        document,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown MongoDB action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

