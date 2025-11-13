// Mock the database before importing
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../config/database', () => ({
  db: mockDb,
  vectorIndexes: {},
  vectorDocuments: {},
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column, value) => ({ column, value })),
  and: jest.fn((...conditions) => ({ conditions })),
}));

import { DatabaseVectorStore } from '../../services/vectorStore';

describe('DatabaseVectorStore', () => {
  let store: DatabaseVectorStore;
  const mockOrganizationId = 'org_123';
  const mockIndexName = 'test-index';

  beforeEach(() => {
    store = new DatabaseVectorStore();
    jest.clearAllMocks();
  });

  describe('getOrCreateIndex', () => {
    it('should return existing index if found', async () => {
      const mockIndex = { id: 'index_123', organizationId: mockOrganizationId, name: mockIndexName };
      
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockIndex]),
          }),
        }),
      });

      const result = await store.getOrCreateIndex(mockOrganizationId, mockIndexName, 'database');
      
      expect(result).toBe('index_123');
    });

    it('should create new index if not found', async () => {
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      (mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 'new_index_123' }]),
        }),
      });

      const result = await store.getOrCreateIndex(mockOrganizationId, mockIndexName, 'database');
      
      expect(result).toBe('new_index_123');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('upsert', () => {
    it('should create new documents', async () => {
      const mockIndexId = 'index_123';
      const documents = [
        { embedding: [0.1, 0.2, 0.3], text: 'Test document 1', metadata: { source: 'test' } },
        { embedding: [0.4, 0.5, 0.6], text: 'Test document 2' },
      ];

      // Mock getOrCreateIndex
      jest.spyOn(store, 'getOrCreateIndex').mockResolvedValue(mockIndexId);

      // Mock document existence check
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]), // No existing documents
          }),
        }),
      });

      // Mock insert
      (mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const result = await store.upsert(mockOrganizationId, mockIndexName, documents);

      expect(result).toHaveLength(2);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should update existing documents', async () => {
      const mockIndexId = 'index_123';
      const mockDocId = 'doc_123';
      const documents = [
        { id: mockDocId, embedding: [0.1, 0.2, 0.3], text: 'Updated document' },
      ];

      jest.spyOn(store, 'getOrCreateIndex').mockResolvedValue(mockIndexId);

      // Mock document exists
      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: mockDocId }]),
          }),
        }),
      });

      // Mock update
      (mockDb.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await store.upsert(mockOrganizationId, mockIndexName, documents);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockDocId);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('should return top-K results sorted by similarity', async () => {
      const mockIndexId = 'index_123';
      const queryEmbedding = [0.1, 0.2, 0.3];
      const mockDocuments = [
        {
          id: 'doc_1',
          embedding: [0.1, 0.2, 0.3], // High similarity
          text: 'Document 1',
          metadata: null,
        },
        {
          id: 'doc_2',
          embedding: [0.9, 0.8, 0.7], // Low similarity
          text: 'Document 2',
          metadata: null,
        },
        {
          id: 'doc_3',
          embedding: [0.2, 0.3, 0.4], // Medium similarity
          text: 'Document 3',
          metadata: null,
        },
      ];

      jest.spyOn(store, 'getOrCreateIndex').mockResolvedValue(mockIndexId);

      (mockDb.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockDocuments),
        }),
      });

      const result = await store.query(mockOrganizationId, mockIndexName, queryEmbedding, 2);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('doc_1'); // Highest similarity
      expect(result[0].score).toBeGreaterThan(result[1].score);
    });
  });

  describe('delete', () => {
    it('should delete documents', async () => {
      const mockIndexId = 'index_123';
      const idsToDelete = ['doc_1', 'doc_2'];

      jest.spyOn(store, 'getOrCreateIndex').mockResolvedValue(mockIndexId);

      (mockDb.delete as jest.Mock).mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      });

      await store.delete(mockOrganizationId, mockIndexName, idsToDelete);

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});

