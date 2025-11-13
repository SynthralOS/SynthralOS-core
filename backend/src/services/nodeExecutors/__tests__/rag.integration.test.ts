/**
 * Integration tests for RAG pipeline
 * Tests the complete RAG workflow: document ingestion -> vector storage -> semantic search -> RAG query
 */

// Mock the database
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../../config/database', () => ({
  db: mockDb,
  workflows: {},
  workspaces: {},
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column, value) => ({ column, value })),
  and: jest.fn((...conditions) => ({ conditions })),
}));

// Mock aiService
const mockGenerateEmbedding = jest.fn();
const mockGenerateText = jest.fn();

jest.mock('../../aiService', () => ({
  aiService: {
    generateEmbedding: mockGenerateEmbedding,
    generateText: mockGenerateText,
  },
}));

// Mock vectorStore
const mockStoreVectors = jest.fn();
const mockQueryVectors = jest.fn();
const mockDeleteVectors = jest.fn();

jest.mock('../../vectorStore', () => ({
  storeVectors: (...args: any[]) => mockStoreVectors(...args),
  queryVectors: (...args: any[]) => mockQueryVectors(...args),
  deleteVectors: (...args: any[]) => mockDeleteVectors(...args),
}));

import { executeDocumentIngest, executeVectorStore, executeSemanticSearch, executeRAG } from '../rag';
import { storeVectors, queryVectors } from '../../vectorStore';

describe('RAG Pipeline Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);
    mockGenerateText.mockResolvedValue({
      content: 'This is a generated answer based on the context.',
      tokensUsed: 50,
    });
    
    mockStoreVectors.mockResolvedValue(['doc1', 'doc2', 'doc3']);
    mockQueryVectors.mockResolvedValue([
      {
        id: 'doc1',
        text: 'Document 1 content about the topic.',
        score: 0.95,
        metadata: { source: 'test' },
      },
      {
        id: 'doc2',
        text: 'Document 2 content with related information.',
        score: 0.88,
        metadata: { source: 'test' },
      },
    ]);
  });

  describe('Complete RAG Pipeline', () => {
    it('should execute full RAG pipeline: ingest -> store -> search -> generate', async () => {
      // Step 1: Document Ingestion
      const documentText = 'This is a test document about artificial intelligence and machine learning. ' +
        'It contains information about neural networks, deep learning, and natural language processing. ' +
        'The document explains how these technologies work together to create intelligent systems.';
      
      const ingestResult = await executeDocumentIngest({
        input: {
          text: documentText,
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
          chunkStrategy: 'fixed',
        },
        workflowId: 'test-workflow',
        nodeId: 'ingest-node',
      });

      expect(ingestResult.success).toBe(true);
      if (!ingestResult.success) return;
      
      expect(ingestResult.output.chunks).toBeDefined();
      expect(ingestResult.output.chunks.length).toBeGreaterThan(0);

      // Step 2: Generate embeddings and store in vector store
      const chunks = ingestResult.output.chunks as string[];
      const embeddings = chunks.map(() => [0.1, 0.2, 0.3, 0.4, 0.5]);
      
      const storeResult = await executeVectorStore({
        input: {
          embeddings,
          texts: chunks,
        },
        config: {
          provider: 'memory',
          operation: 'store',
          indexName: 'test-index',
        },
        workflowId: 'test-workflow',
        nodeId: 'store-node',
      });

      expect(storeResult.success).toBe(true);
      if (!storeResult.success) return;
      expect(storeResult.output.ids).toBeDefined();
      expect(mockStoreVectors).toHaveBeenCalled();

      // Step 3: Semantic Search
      const searchResult = await executeSemanticSearch({
        input: {
          query: 'What is artificial intelligence?',
        },
        config: {
          provider: 'memory',
          indexName: 'test-index',
          topK: 3,
          minScore: 0.7,
        },
        workflowId: 'test-workflow',
        nodeId: 'search-node',
      });

      expect(searchResult.success).toBe(true);
      if (!searchResult.success) return;
      expect(searchResult.output.results).toBeDefined();
      expect(mockGenerateEmbedding).toHaveBeenCalled();
      expect(mockQueryVectors).toHaveBeenCalled();

      // Step 4: RAG Pipeline (complete workflow)
      const ragResult = await executeRAG({
        input: {
          query: 'What is artificial intelligence?',
        },
        config: {
          vectorStoreProvider: 'memory',
          indexName: 'test-index',
          llmProvider: 'openai',
          model: 'gpt-3.5-turbo',
          topK: 3,
        },
        workflowId: 'test-workflow',
        nodeId: 'rag-node',
      });

      expect(ragResult.success).toBe(true);
      if (!ragResult.success) return;
      expect(ragResult.output.answer).toBeDefined();
      expect(ragResult.output.sources).toBeDefined();
      expect(ragResult.output.sources.length).toBeGreaterThan(0);
      expect(mockGenerateText).toHaveBeenCalled();
    });

    it('should handle empty vector store gracefully', async () => {
      // Mock empty search results
      mockQueryVectors.mockResolvedValueOnce([]);

      const ragResult = await executeRAG({
        input: {
          query: 'What is artificial intelligence?',
        },
        config: {
          vectorStoreProvider: 'memory',
          indexName: 'empty-index',
          llmProvider: 'openai',
          model: 'gpt-3.5-turbo',
          topK: 3,
        },
        workflowId: 'test-workflow',
        nodeId: 'rag-node',
      });

      expect(ragResult.success).toBe(false);
      if (ragResult.success) return;
      expect(ragResult.error?.code).toBe('NO_RESULTS');
      expect(ragResult.error?.message).toContain('No relevant documents');
    });

    it('should handle missing query in RAG pipeline', async () => {
      const ragResult = await executeRAG({
        input: {},
        config: {
          vectorStoreProvider: 'memory',
          indexName: 'test-index',
          llmProvider: 'openai',
          model: 'gpt-3.5-turbo',
        },
        workflowId: 'test-workflow',
        nodeId: 'rag-node',
      });

      expect(ragResult.success).toBe(false);
      if (ragResult.success) return;
      expect(ragResult.error?.code).toBe('MISSING_QUERY');
    });

    it('should use custom prompt template in RAG pipeline', async () => {
      const customTemplate = 'Based on this context: {{context}}\n\nAnswer this question: {{query}}\n\nYour answer:';
      
      const ragResult = await executeRAG({
        input: {
          query: 'What is machine learning?',
        },
        config: {
          vectorStoreProvider: 'memory',
          indexName: 'test-index',
          llmProvider: 'openai',
          model: 'gpt-3.5-turbo',
          promptTemplate: customTemplate,
          topK: 2,
        },
        workflowId: 'test-workflow',
        nodeId: 'rag-node',
      });

      expect(ragResult.success).toBe(true);
      expect(mockGenerateText).toHaveBeenCalled();
      
      // Verify the prompt contains the custom template structure
      const callArgs = mockGenerateText.mock.calls[0];
      expect(callArgs[0].prompt).toContain('Based on this context:');
      expect(callArgs[0].prompt).toContain('Answer this question:');
    });
  });

  describe('Vector Store Operations', () => {
    it('should store and retrieve vectors correctly', async () => {
      const texts = ['Document 1', 'Document 2', 'Document 3'];
      const embeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
      ];

      // Store vectors
      const storeResult = await executeVectorStore({
        input: {
          embeddings,
          texts,
        },
        config: {
          provider: 'memory',
          operation: 'store',
          indexName: 'test-index',
        },
        workflowId: 'test-workflow',
        nodeId: 'store-node',
      });

      expect(storeResult.success).toBe(true);
      expect(mockStoreVectors).toHaveBeenCalledWith(
        'memory',
        'test-index',
        expect.arrayContaining([
          expect.objectContaining({
            embedding: embeddings[0],
            text: texts[0],
          }),
        ]),
        undefined,
        null
      );

      // Search vectors
      const searchResult = await executeSemanticSearch({
        input: {
          query: 'test query',
        },
        config: {
          provider: 'memory',
          indexName: 'test-index',
          topK: 2,
        },
        workflowId: 'test-workflow',
        nodeId: 'search-node',
      });

      expect(searchResult.success).toBe(true);
      expect(mockQueryVectors).toHaveBeenCalled();
    });

    it('should handle vector store errors gracefully', async () => {
      mockStoreVectors.mockRejectedValueOnce(new Error('Vector store error'));

      const storeResult = await executeVectorStore({
        input: {
          embeddings: [[0.1, 0.2, 0.3]],
          texts: ['Test document'],
        },
        config: {
          provider: 'memory',
          operation: 'store',
          indexName: 'test-index',
        },
        workflowId: 'test-workflow',
        nodeId: 'store-node',
      });

      expect(storeResult.success).toBe(false);
      if (storeResult.success) return;
      expect(storeResult.error?.code).toBe('VECTOR_STORE_ERROR');
    });
  });

  describe('Semantic Search', () => {
    it('should filter results by minScore', async () => {
      mockQueryVectors.mockResolvedValueOnce([
        { id: 'doc1', text: 'High score doc', score: 0.95, metadata: {} },
        { id: 'doc2', text: 'Low score doc', score: 0.5, metadata: {} },
        { id: 'doc3', text: 'Medium score doc', score: 0.75, metadata: {} },
      ]);

      const searchResult = await executeSemanticSearch({
        input: {
          query: 'test query',
        },
        config: {
          provider: 'memory',
          indexName: 'test-index',
          topK: 5,
          minScore: 0.7,
        },
        workflowId: 'test-workflow',
        nodeId: 'search-node',
      });

      expect(searchResult.success).toBe(true);
      if (!searchResult.success) return;
      
      // Results should be filtered by minScore
      const results = searchResult.output.results as any[];
      results.forEach((result: any) => {
        expect(result.score).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should handle missing query in semantic search', async () => {
      const searchResult = await executeSemanticSearch({
        input: {},
        config: {
          provider: 'memory',
          indexName: 'test-index',
        },
        workflowId: 'test-workflow',
        nodeId: 'search-node',
      });

      expect(searchResult.success).toBe(false);
      if (searchResult.success) return;
      expect(searchResult.error?.code).toBe('MISSING_QUERY');
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should pass organizationId when using database provider', async () => {
      // Mock database query to return organizationId
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([{ organizationId: 'org_123' }]),
            }),
          }),
        }),
      });

      const storeResult = await executeVectorStore({
        input: {
          embeddings: [[0.1, 0.2, 0.3]],
          texts: ['Test document'],
        },
        config: {
          provider: 'database',
          operation: 'store',
          indexName: 'test-index',
        },
        workflowId: 'test-workflow',
        nodeId: 'store-node',
      });

      expect(storeResult.success).toBe(true);
      // Verify organizationId was passed to storeVectors
      expect(mockStoreVectors).toHaveBeenCalledWith(
        'database',
        'test-index',
        expect.any(Array),
        undefined,
        'org_123'
      );
    });
  });
});

