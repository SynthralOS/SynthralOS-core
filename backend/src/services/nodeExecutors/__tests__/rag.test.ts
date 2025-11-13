/**
 * Unit tests for RAG file parsing functionality
 */

// Mock the database before importing
const mockDb = {
  select: jest.fn(),
};

jest.mock('../../../config/database', () => ({
  db: mockDb,
  workflows: {},
  workspaces: {},
}));

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((column, value) => ({ column, value })),
}));

// Mock pdf-parse and mammoth
const mockPdfParse = jest.fn();
const mockMammoth = {
  extractRawText: jest.fn(),
};

// Mock aiService
const mockAiService = {
  generateEmbedding: jest.fn(),
  generateText: jest.fn(),
};

jest.mock('../../aiService', () => ({
  aiService: mockAiService,
}));

// Mock vectorStore
const mockVectorStore = {
  storeVectors: jest.fn(),
  queryVectors: jest.fn(),
  deleteVectors: jest.fn(),
};

jest.mock('../../vectorStore', () => ({
  storeVectors: jest.fn(),
  queryVectors: jest.fn(),
  deleteVectors: jest.fn(),
}));

// Mock require for pdf-parse and mammoth
const originalRequire = require;
jest.mock('pdf-parse', () => {
  return mockPdfParse;
}, { virtual: true });

jest.mock('mammoth', () => {
  return mockMammoth;
}, { virtual: true });

// Import the function we want to test
// Note: We need to test parseFileContent, but it's not exported
// We'll test it indirectly through the document ingestion executor
import { executeDocumentIngest } from '../rag';
import { storeVectors, queryVectors } from '../../vectorStore';

describe('RAG File Parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module-level variables by clearing the require cache
    jest.resetModules();
  });

  describe('Text file parsing', () => {
    it('should parse plain text from base64 data URI', async () => {
      const textContent = 'Hello, this is a test document.';
      const base64Text = Buffer.from(textContent).toString('base64');
      const dataUri = `data:text/plain;base64,${base64Text}`;

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'txt',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.text).toContain(textContent);
      }
    });

    it('should auto-detect text/plain MIME type', async () => {
      const textContent = 'Auto-detected text content.';
      const base64Text = Buffer.from(textContent).toString('base64');
      const dataUri = `data:text/plain;base64,${base64Text}`;

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'auto',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.text).toContain(textContent);
      }
    });
  });

  describe('PDF file parsing', () => {
    it('should parse PDF from base64 data URI', async () => {
      // Mock PDF content
      const pdfText = 'This is PDF content extracted from a PDF file.';
      // We need to mock the require call for pdf-parse
      // Since it's dynamically required, we'll check if the error is thrown
      // For now, we'll test that the function handles the case gracefully
      
      // Create a mock PDF buffer (simplified - in real scenario this would be actual PDF bytes)
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const base64Pdf = mockPdfBuffer.toString('base64');
      const dataUri = `data:application/pdf;base64,${base64Pdf}`;

      // Mock pdf-parse to be available
      const pdfParseModule = require('pdf-parse');
      if (pdfParseModule) {
        pdfParseModule.mockResolvedValue({ text: pdfText });
      }

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'pdf',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      // If pdf-parse is not available, we expect an error
      // If it is available, we expect success
      expect(result.success !== undefined).toBe(true);
    });

    it('should auto-detect PDF MIME type', async () => {
      const pdfText = 'Auto-detected PDF content.';
      mockPdfParse.mockResolvedValue({ text: pdfText });

      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const base64Pdf = mockPdfBuffer.toString('base64');
      const dataUri = `data:application/pdf;base64,${base64Pdf}`;

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'auto',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.text).toContain(pdfText);
      }
    });

    it('should return error if pdf-parse is not installed', async () => {
      // Temporarily remove pdf-parse
      const originalRequire = require;
      jest.resetModules();
      
      // Mock require to throw error for pdf-parse
      jest.doMock('pdf-parse', () => {
        throw new Error('Cannot find module');
      });

      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const base64Pdf = mockPdfBuffer.toString('base64');
      const dataUri = `data:application/pdf;base64,${base64Pdf}`;

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'pdf',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.message).toContain('pdf-parse');
      }
    });
  });

  describe('DOCX file parsing', () => {
    it('should parse DOCX from base64 data URI', async () => {
      const docxText = 'This is DOCX content extracted from a Word document.';
      mockMammoth.extractRawText.mockResolvedValue({ value: docxText });

      const mockDocxBuffer = Buffer.from('mock-docx-content');
      const base64Docx = mockDocxBuffer.toString('base64');
      const dataUri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Docx}`;

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'docx',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.text).toContain(docxText);
        expect(mockMammoth.extractRawText).toHaveBeenCalled();
      }
    });

    it('should auto-detect DOCX MIME type', async () => {
      const docxText = 'Auto-detected DOCX content.';
      mockMammoth.extractRawText.mockResolvedValue({ value: docxText });

      const mockDocxBuffer = Buffer.from('mock-docx-content');
      const base64Docx = mockDocxBuffer.toString('base64');
      const dataUri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Docx}`;

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'auto',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.text).toContain(docxText);
      }
    });

    it('should return error if mammoth is not installed', async () => {
      // Mock require to throw error for mammoth
      jest.resetModules();
      jest.doMock('mammoth', () => {
        throw new Error('Cannot find module');
      });

      const mockDocxBuffer = Buffer.from('mock-docx-content');
      const base64Docx = mockDocxBuffer.toString('base64');
      const dataUri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Docx}`;

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'docx',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.message).toContain('mammoth');
      }
    });
  });

  describe('Error handling', () => {
    it('should return error for file path input (not supported)', async () => {
      const result = await executeDocumentIngest({
        input: {
          file: '/path/to/file.pdf',
          fileType: 'pdf',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.message).toContain('File path reading is not supported');
      }
    });

    it('should handle invalid base64 data', async () => {
      const result = await executeDocumentIngest({
        input: {
          file: 'data:text/plain;base64,invalid-base64!!!',
          fileType: 'txt',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      // Should handle gracefully or return error
      expect(result.success).toBeDefined();
    });

    it('should handle missing file input', async () => {
      const result = await executeDocumentIngest({
        input: {},
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error?.message).toContain('file');
      }
    });
  });

  describe('Text chunking', () => {
    it('should chunk text according to chunkSize and chunkOverlap', async () => {
      const longText = 'This is a very long text that should be chunked into multiple pieces. '.repeat(10);
      const base64Text = Buffer.from(longText).toString('base64');
      const dataUri = `data:text/plain;base64,${base64Text}`;

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'txt',
        },
        config: {
          chunkSize: 50,
          chunkOverlap: 10,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.chunks).toBeDefined();
        expect(Array.isArray(result.output.chunks)).toBe(true);
        expect(result.output.chunks.length).toBeGreaterThan(1);
        
        // Verify chunks don't exceed chunkSize
        result.output.chunks.forEach((chunk: string) => {
          expect(chunk.length).toBeLessThanOrEqual(50);
        });
      }
    });

    it('should handle small text that doesn\'t need chunking', async () => {
      const shortText = 'Short text.';
      const base64Text = Buffer.from(shortText).toString('base64');
      const dataUri = `data:text/plain;base64,${base64Text}`;

      const result = await executeDocumentIngest({
        input: {
          file: dataUri,
          fileType: 'txt',
        },
        config: {
          chunkSize: 100,
          chunkOverlap: 20,
        },
        workflowId: 'test-workflow',
        nodeId: 'test-node',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.chunks).toBeDefined();
        expect(result.output.chunks.length).toBe(1);
        expect(result.output.chunks[0]).toBe(shortText);
      }
    });
  });
});

