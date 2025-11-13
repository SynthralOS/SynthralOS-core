import { createWorker, Worker } from 'tesseract.js';
import axios from 'axios';
import sharp from 'sharp';
import pdfParse from 'pdf-parse';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// Dynamic imports for cloud providers (optional dependencies)
let vision: any = null;
let TextractClient: any = null;
let DetectDocumentTextCommand: any = null;
let AnalyzeDocumentCommand: any = null;

try {
  const visionModule = require('@google-cloud/vision');
  vision = visionModule;
} catch (error) {
  // Google Cloud Vision not available
}

try {
  const textractModule = require('@aws-sdk/client-textract');
  TextractClient = textractModule.TextractClient;
  DetectDocumentTextCommand = textractModule.DetectDocumentTextCommand;
  AnalyzeDocumentCommand = textractModule.AnalyzeDocumentCommand;
} catch (error) {
  // AWS Textract not available
}

// Types
export interface OCRInput {
  imageUrl?: string;
  imageBase64?: string;
  pdfUrl?: string;
  pdfBase64?: string;
  file?: string;
}

export interface OCRConfig {
  provider: 'tesseract' | 'google' | 'aws' | 'azure' | 'openai';
  language?: string;
  extractTables?: boolean;
  extractForms?: boolean;
  preprocess?: boolean;
  apiKey?: string;
}

export interface OCRResult {
  text: string;
  structuredData?: {
    tables?: any[];
    forms?: any[];
  };
  confidence: number;
  metadata: {
    language: string;
    pages: number;
    processingTime: number;
    provider: string;
  };
  pages?: Array<{
    pageNumber: number;
    text: string;
    confidence: number;
  }>;
}

/**
 * OCR Service - Handles OCR processing with multiple provider support
 */
export class OCRService {
  private workers: Map<string, Worker> = new Map();
  private cache: Map<string, { result: OCRResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly MAX_CACHE_SIZE = 100; // Maximum number of cached results

  /**
   * Process input with OCR
   */
  async process(input: OCRInput, config: OCRConfig): Promise<OCRResult> {
    const startTime = Date.now();

    // Check cache first (only for non-cloud providers to avoid API costs)
    if (config.provider === 'tesseract') {
      const cacheKey = this.generateCacheKey(input, config);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        // Return cached result with updated processing time
        return {
          ...cached.result,
          metadata: {
            ...cached.result.metadata,
            processingTime: Date.now() - startTime,
          },
        };
      }
    }

    // Detect file type and prepare buffers
    const { buffers, fileType } = await this.prepareBuffers(input);
    if (!buffers || buffers.length === 0) {
      throw new Error('Failed to prepare buffers from input');
    }

    // Auto-detect language if needed
    let detectedLanguage = config.language;
    if (!config.language || config.language === 'auto') {
      detectedLanguage = await this.detectLanguage(buffers[0], config.provider, config);
      // Update config with detected language for processing
      config = { ...config, language: detectedLanguage };
    }

    // Route to appropriate provider
    let result: OCRResult;
    switch (config.provider) {
      case 'tesseract':
        result = await this.processWithTesseract(buffers, fileType, config);
        break;
      case 'google':
        result = await this.processWithGoogle(buffers, fileType, config);
        break;
      case 'aws':
        result = await this.processWithAWS(buffers, fileType, config);
        break;
      case 'azure':
        throw new Error('Azure Computer Vision not yet implemented. Use tesseract, google, or aws for now.');
      case 'openai':
        throw new Error('OpenAI Vision OCR not yet implemented. Use tesseract, google, or aws for now.');
      default:
        throw new Error(`Unsupported OCR provider: ${config.provider}`);
    }

    // Update processing time and detected language
    result.metadata.processingTime = Date.now() - startTime;
    if (detectedLanguage && detectedLanguage !== 'auto') {
      result.metadata.language = detectedLanguage;
    }

    // Cache result (only for Tesseract to avoid API costs)
    if (config.provider === 'tesseract') {
      const cacheKey = this.generateCacheKey(input, config);
      this.setCache(cacheKey, result);
    }

    return result;
  }

  /**
   * Generate cache key from input and config
   */
  private generateCacheKey(input: OCRInput, config: OCRConfig): string {
    // Create a hash of input and relevant config
    const inputStr = JSON.stringify({
      imageUrl: input.imageUrl,
      imageBase64: input.imageBase64?.substring(0, 100), // First 100 chars for hash
      pdfUrl: input.pdfUrl,
      pdfBase64: input.pdfBase64?.substring(0, 100),
      file: input.file,
      provider: config.provider,
      language: config.language,
      preprocess: config.preprocess,
    });
    return crypto.createHash('sha256').update(inputStr).digest('hex');
  }

  /**
   * Set cache with size limit
   */
  private setCache(key: string, result: OCRResult): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Prepare buffers from various input formats
   * Returns array of buffers (for multi-page PDFs) and file type
   */
  private async prepareBuffers(input: OCRInput): Promise<{ buffers: Buffer[]; fileType: 'image' | 'pdf' }> {
    let buffer: Buffer | null = null;
    let fileType: 'image' | 'pdf' = 'image';

    // Handle base64 image
    if (input.imageBase64) {
      buffer = this.base64ToBuffer(input.imageBase64);
      fileType = 'image';
    }
    // Handle image URL
    else if (input.imageUrl) {
      buffer = await this.fetchFromUrl(input.imageUrl);
      fileType = 'image';
    }
    // Handle base64 PDF
    else if (input.pdfBase64) {
      buffer = this.base64ToBuffer(input.pdfBase64);
      fileType = 'pdf';
    }
    // Handle PDF URL
    else if (input.pdfUrl) {
      buffer = await this.fetchFromUrl(input.pdfUrl);
      fileType = 'pdf';
    }
    // Handle file (base64 string or file path)
    else if (input.file) {
      if (input.file.startsWith('data:')) {
        buffer = this.base64ToBuffer(input.file);
        // Detect type from MIME type
        const mimeType = input.file.split(',')[0].split(':')[1].split(';')[0];
        fileType = mimeType === 'application/pdf' ? 'pdf' : 'image';
      } else {
        // File path - read from filesystem
        buffer = await fs.readFile(input.file);
        // Detect type from extension
        const ext = path.extname(input.file).toLowerCase();
        fileType = ext === '.pdf' ? 'pdf' : 'image';
      }
    }

    if (!buffer) {
      return { buffers: [], fileType: 'image' };
    }

    // If PDF, extract pages
    if (fileType === 'pdf') {
      const buffers = await this.extractPDFPages(buffer);
      return { buffers, fileType: 'pdf' };
    }

    // For images, return single buffer
    return { buffers: [buffer], fileType: 'image' };
  }

  /**
   * Fetch file from URL with timeout and size limits
   */
  private async fetchFromUrl(url: string, timeout: number = 30000, maxSize: number = 10 * 1024 * 1024): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout,
        maxContentLength: maxSize,
        maxBodyLength: maxSize,
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Request timeout while fetching ${url}`);
      }
      if (error.response?.status === 413 || error.message.includes('maxContentLength')) {
        throw new Error(`File too large (max ${maxSize / 1024 / 1024}MB)`);
      }
      throw new Error(`Failed to fetch from URL: ${error.message}`);
    }
  }

  /**
   * Extract pages from PDF
   * For text-based PDFs, extract text directly per page
   * For scanned PDFs, return buffer for OCR processing
   */
  private async extractPDFPages(buffer: Buffer): Promise<Buffer[]> {
    try {
      // Try to extract text directly first (text-based PDF)
      const pdfData = await pdfParse(buffer);
      
      // Check if it's a text-based PDF (has substantial text)
      if (pdfData.text.trim().length > 100) {
        // Text-based PDF - return buffer for direct text extraction
        // We'll handle per-page extraction in the processing methods
        return [buffer]; // Single buffer, but contains all pages
      }
      
      // Check page count for multi-page handling
      const pageCount = pdfData.numpages || 1;
      
      // For text-based PDFs with multiple pages, we can extract per page
      // But pdf-parse already extracts all text, so we return single buffer
      // Individual providers will handle page separation if needed
      return [buffer];
    } catch (error) {
      // PDF parsing failed, treat as scanned PDF
      // For scanned PDFs, we would need to convert pages to images
      // This requires pdf2pic or similar library (to be added in future)
      // For now, return the PDF buffer
      // Note: Tesseract.js doesn't directly support PDF
      // AWS Textract and Google Vision handle PDFs natively
      return [buffer];
    }
  }

  /**
   * Detect language from text or image
   * Uses provider-specific detection or simple heuristics
   */
  private async detectLanguage(
    buffer: Buffer,
    provider: string,
    config: OCRConfig
  ): Promise<string> {
    // If language is explicitly set, use it
    if (config.language && config.language !== 'auto') {
      return config.language;
    }

    // For Google Vision, it auto-detects and returns locale
    if (provider === 'google') {
      // Will be detected during processing
      return 'auto';
    }

    // For AWS Textract, it auto-detects
    if (provider === 'aws') {
      return 'auto';
    }

    // For Tesseract, try OSD (Orientation and Script Detection)
    if (provider === 'tesseract') {
      try {
        const worker = await createWorker('osd'); // OSD mode
        const { data } = await worker.detect(buffer);
        await worker.terminate();
        
        // Map script to language code
        // Tesseract OSD returns script, not language, so we use common mappings
        const scriptToLang: Record<string, string> = {
          'Latin': 'eng',
          'Cyrillic': 'rus',
          'Arabic': 'ara',
          'Devanagari': 'hin',
          'Han': 'chi_sim',
          'Japanese': 'jpn',
          'Korean': 'kor',
        };
        
        const detectedScript = data.script || 'Latin';
        return scriptToLang[detectedScript] || 'eng';
      } catch (error) {
        // OSD failed, default to English
        return 'eng';
      }
    }

    // Default to English
    return 'eng';
  }

  /**
   * Convert base64 data URI to Buffer
   */
  private base64ToBuffer(dataUri: string): Buffer {
    // Remove data URL prefix if present
    const base64Data = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Process with Tesseract.js
   */
  private async processWithTesseract(
    buffers: Buffer[],
    fileType: 'image' | 'pdf',
    config: OCRConfig
  ): Promise<OCRResult> {
    const language = config.language || 'eng';
    const workerKey = `tesseract-${language}`;

    // Get or create worker for this language
    let worker = this.workers.get(workerKey);
    if (!worker) {
      worker = await createWorker(language);
      this.workers.set(workerKey, worker);
    }

    try {
      const pageResults: Array<{ pageNumber: number; text: string; confidence: number }> = [];
      let allText = '';
      let totalConfidence = 0;

      // Process each buffer (page)
      for (let i = 0; i < buffers.length; i++) {
        const buffer = buffers[i];
        let imageBuffer = buffer;

        // Handle PDF: Try to extract text directly first
        if (fileType === 'pdf') {
          try {
            const pdfData = await pdfParse(buffer);
            if (pdfData.text.trim().length > 100) {
              // Text-based PDF - use extracted text directly
              // For multi-page PDFs, pdf-parse extracts all pages
              const text = pdfData.text;
              const pageCount = pdfData.numpages || 1;
              const confidence = 0.95; // High confidence for direct text extraction
              
              // If single page or all text together
              if (pageCount === 1) {
                pageResults.push({
                  pageNumber: 1,
                  text,
                  confidence,
                });
                allText = text;
                totalConfidence = confidence;
              } else {
                // Multi-page PDF - split text by page if possible
                // pdf-parse doesn't provide per-page text, so we use the full text
                // and mark it as page 1 (all pages combined)
                // For better per-page handling, would need different PDF library
                pageResults.push({
                  pageNumber: 1,
                  text,
                  confidence,
                });
                allText = text;
                totalConfidence = confidence;
              }
              break; // Skip OCR processing
            }
          } catch (error) {
            // PDF parsing failed, continue with OCR
            // Note: Tesseract.js doesn't support PDF directly
            // This is a limitation - would need pdf2pic for full support
            throw new Error('Scanned PDF support requires additional setup. Please convert PDF pages to images first.');
          }
        }

        // Preprocess image if enabled
        if (config.preprocess && fileType === 'image') {
          imageBuffer = await this.preprocessImage(imageBuffer);
        }

        // Perform OCR
        const { data } = await worker.recognize(imageBuffer);

        // Calculate average confidence
        const words = data.words || [];
        const confidences = words
          .map((w: any) => w.confidence || 0)
          .filter((c: number) => c > 0);

        const avgConfidence =
          confidences.length > 0
            ? confidences.reduce((a: number, b: number) => a + b, 0) /
              confidences.length /
              100 // Convert to 0-1 scale
            : 0.85; // Default confidence if no words found

        const pageText = data.text || '';
        pageResults.push({
          pageNumber: i + 1,
          text: pageText,
          confidence: Math.max(0, Math.min(1, avgConfidence)),
        });

        allText += (allText ? '\n\n' : '') + pageText;
        totalConfidence += avgConfidence;
      }

      // Calculate overall confidence
      const overallConfidence = pageResults.length > 0
        ? totalConfidence / pageResults.length
        : 0.85;

      return {
        text: allText,
        confidence: Math.max(0, Math.min(1, overallConfidence)),
        metadata: {
          language: language,
          pages: pageResults.length,
          processingTime: 0, // Will be set by caller
          provider: 'tesseract',
        },
        pages: pageResults,
      };
    } catch (error: any) {
      throw new Error(`Tesseract OCR failed: ${error.message}`);
    }
  }

  /**
   * Preprocess image to improve OCR accuracy
   */
  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      const processed = await sharp(buffer)
        .greyscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen() // Sharpen edges
        .toBuffer();
      return processed;
    } catch (error: any) {
      // If preprocessing fails, return original buffer
      console.warn('Image preprocessing failed, using original:', error.message);
      return buffer;
    }
  }

  /**
   * Process with Google Cloud Vision API
   */
  private async processWithGoogle(
    buffers: Buffer[],
    fileType: 'image' | 'pdf',
    config: OCRConfig
  ): Promise<OCRResult> {
    if (!vision) {
      throw new Error(
        'Google Cloud Vision API not available. Please install @google-cloud/vision package.'
      );
    }

    // Initialize client
    const apiKey = config.apiKey || process.env.GOOGLE_VISION_API_KEY;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    let client: any;
    if (apiKey) {
      // Use API key authentication
      client = new vision.ImageAnnotatorClient({
        apiKey: apiKey,
      });
    } else if (credentialsPath) {
      // Use service account credentials
      client = new vision.ImageAnnotatorClient({
        keyFilename: credentialsPath,
      });
    } else {
      // Try default credentials
      client = new vision.ImageAnnotatorClient();
    }

    const pageResults: Array<{ pageNumber: number; text: string; confidence: number }> = [];
    let allText = '';
    let totalConfidence = 0;

    // Process each buffer (page)
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];

      // Handle PDF: Google Vision supports PDF natively
      if (fileType === 'pdf') {
        // For PDFs, use asyncBatchAnnotateFiles
        // Note: This requires file in GCS, so for now we'll process as image
        // Full PDF support would require uploading to GCS first
        throw new Error(
          'PDF processing with Google Vision requires file in Google Cloud Storage. Please use image format or convert PDF to images first.'
        );
      }

      try {
        // Perform text detection
        const [result] = await client.textDetection({
          image: { content: buffer },
        });

        const detections = result.textAnnotations || [];
        const fullText = detections[0]?.description || '';
        
        // Detect language from locale (Google Vision provides this)
        const detectedLocale = detections[0]?.locale || config.language || 'en';
        const detectedLanguage = detectedLocale.split('-')[0] || 'en'; // Extract language code from locale

        // Calculate average confidence from word-level detections
        const wordConfidences: number[] = [];
        detections.slice(1).forEach((detection: any) => {
          if (detection.confidence !== undefined && detection.confidence > 0) {
            wordConfidences.push(detection.confidence);
          }
        });

        const avgConfidence =
          wordConfidences.length > 0
            ? wordConfidences.reduce((a, b) => a + b, 0) / wordConfidences.length
            : 0.95; // Default high confidence for Google Vision

        pageResults.push({
          pageNumber: i + 1,
          text: fullText,
          confidence: Math.max(0, Math.min(1, avgConfidence)),
        });

        allText += (allText ? '\n\n' : '') + fullText;
        totalConfidence += avgConfidence;
        
        // Update detected language for metadata
        if (i === 0) {
          config.language = detectedLanguage;
        }
      } catch (error: any) {
        throw new Error(`Google Vision API failed: ${error.message}`);
      }
    }

    // Calculate overall confidence
    const overallConfidence =
      pageResults.length > 0 ? totalConfidence / pageResults.length : 0.95;

    return {
      text: allText,
      confidence: Math.max(0, Math.min(1, overallConfidence)),
      metadata: {
        language: config.language || 'en', // Will be updated with detected language
        pages: pageResults.length,
        processingTime: 0, // Will be set by caller
        provider: 'google',
      },
      pages: pageResults,
    };
  }

  /**
   * Process with AWS Textract
   */
  private async processWithAWS(
    buffers: Buffer[],
    fileType: 'image' | 'pdf',
    config: OCRConfig
  ): Promise<OCRResult> {
    if (!TextractClient || !DetectDocumentTextCommand || !AnalyzeDocumentCommand) {
      throw new Error(
        'AWS Textract not available. Please install @aws-sdk/client-textract package.'
      );
    }

    // Initialize client
    const accessKeyId = config.apiKey || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'AWS credentials required. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables, or provide API key in config.'
      );
    }

    const client = new TextractClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const pageResults: Array<{ pageNumber: number; text: string; confidence: number }> = [];
    let allText = '';
    let totalConfidence = 0;

    // Determine feature types for analysis
    const featureTypes: string[] = [];
    if (config.extractTables) {
      featureTypes.push('TABLES');
    }
    if (config.extractForms) {
      featureTypes.push('FORMS');
    }

    // Process each buffer (page)
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];

      try {
        let response: any;

        // Use AnalyzeDocument for tables/forms, DetectDocumentText for simple text
        if (featureTypes.length > 0) {
          const command = new AnalyzeDocumentCommand({
            Document: { Bytes: buffer },
            FeatureTypes: featureTypes as any,
          });
          response = await client.send(command);
        } else {
          const command = new DetectDocumentTextCommand({
            Document: { Bytes: buffer },
          });
          response = await client.send(command);
        }

        // Extract text from blocks
        const blocks = response.Blocks || [];
        const textBlocks = blocks.filter((b: any) => b.BlockType === 'LINE');
        const pageText = textBlocks.map((b: any) => b.Text || '').join('\n');
        
        // AWS Textract doesn't explicitly return language, but we can infer from text patterns
        // For now, we'll use the configured language or default to 'en'

        // Calculate average confidence
        const confidences = textBlocks
          .map((b: any) => b.Confidence || 0)
          .filter((c: number) => c > 0);
        const avgConfidence =
          confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
            : 0.95;

        // Extract tables if requested
        let tables: any[] = [];
        if (config.extractTables) {
          tables = this.extractTablesFromAWS(blocks);
        }

        // Extract forms if requested
        let forms: any[] = [];
        if (config.extractForms) {
          forms = this.extractFormsFromAWS(blocks);
        }

        pageResults.push({
          pageNumber: i + 1,
          text: pageText,
          confidence: Math.max(0, Math.min(1, avgConfidence)),
        });

        allText += (allText ? '\n\n' : '') + pageText;
        totalConfidence += avgConfidence;

        // Store structured data in first page result
        if (i === 0 && (tables.length > 0 || forms.length > 0)) {
          // This will be merged into final result
        }
      } catch (error: any) {
        throw new Error(`AWS Textract failed: ${error.message}`);
      }
    }

    // Calculate overall confidence
    const overallConfidence =
      pageResults.length > 0 ? totalConfidence / pageResults.length : 0.95;

    // Extract structured data from first page (AWS Textract processes per page)
    let structuredData: { tables?: any[]; forms?: any[] } | undefined;
    if (config.extractTables || config.extractForms) {
      // Re-process first buffer to get structured data
      try {
        const featureTypes: string[] = [];
        if (config.extractTables) featureTypes.push('TABLES');
        if (config.extractForms) featureTypes.push('FORMS');

        if (featureTypes.length > 0) {
          const command = new AnalyzeDocumentCommand({
            Document: { Bytes: buffers[0] },
            FeatureTypes: featureTypes as any,
          });
          const response = await client.send(command);
          const blocks = response.Blocks || [];

          structuredData = {};
          if (config.extractTables) {
            structuredData.tables = this.extractTablesFromAWS(blocks);
          }
          if (config.extractForms) {
            structuredData.forms = this.extractFormsFromAWS(blocks);
          }
        }
      } catch (error) {
        // If structured extraction fails, continue without it
        console.warn('Failed to extract structured data:', error);
      }
    }

    return {
      text: allText,
      structuredData,
      confidence: Math.max(0, Math.min(1, overallConfidence)),
      metadata: {
        language: 'en', // AWS auto-detects
        pages: pageResults.length,
        processingTime: 0, // Will be set by caller
        provider: 'aws',
      },
      pages: pageResults,
    };
  }

  /**
   * Extract tables from AWS Textract blocks
   */
  private extractTablesFromAWS(blocks: any[]): any[] {
    const tables: any[] = [];
    const tableBlocks = blocks.filter((b) => b.BlockType === 'TABLE');

    for (const tableBlock of tableBlocks) {
      const cells = blocks.filter(
        (b) => b.BlockType === 'CELL' && b.Relationships?.some((r: any) => r.Ids.includes(tableBlock.Id))
      );

      // Group cells by row
      const rows: Map<number, any[]> = new Map();
      cells.forEach((cell) => {
        const rowIndex = cell.RowIndex || 0;
        if (!rows.has(rowIndex)) {
          rows.set(rowIndex, []);
        }
        rows.get(rowIndex)!.push(cell);
      });

      // Sort rows and cells
      const sortedRows = Array.from(rows.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([_, cells]) => {
          return cells
            .sort((a, b) => (a.ColumnIndex || 0) - (b.ColumnIndex || 0))
            .map((cell) => {
              const textBlocks = cell.Relationships?.find((r: any) => r.Type === 'CHILD')?.Ids || [];
              const text = textBlocks
                .map((id: string) => {
                  const block = blocks.find((b) => b.Id === id);
                  return block?.Text || '';
                })
                .join(' ');
              return text;
            });
        });

      // First row as headers if available
      const headers = sortedRows.length > 0 ? sortedRows[0] : [];
      const dataRows = sortedRows.slice(1);

      tables.push({
        headers,
        rows: dataRows,
        confidence: tableBlock.Confidence ? tableBlock.Confidence / 100 : 0.9,
      });
    }

    return tables;
  }

  /**
   * Extract form fields from AWS Textract blocks
   */
  private extractFormsFromAWS(blocks: any[]): any[] {
    const forms: any[] = [];
    const keyValueBlocks = blocks.filter((b) => b.BlockType === 'KEY_VALUE_SET' && b.EntityTypes?.includes('KEY'));

    for (const keyBlock of keyValueBlocks) {
      // Find associated value
      const valueIds = keyBlock.Relationships?.find((r: any) => r.Type === 'VALUE')?.Ids || [];
      const valueBlock = blocks.find((b) => valueIds.includes(b.Id));

      // Extract key text
      const keyTextBlocks = keyBlock.Relationships?.find((r: any) => r.Type === 'CHILD')?.Ids || [];
      const key = keyTextBlocks
        .map((id: string) => {
          const block = blocks.find((b) => b.Id === id);
          return block?.Text || '';
        })
        .join(' ')
        .trim();

      // Extract value text
      let value = '';
      if (valueBlock) {
        const valueTextBlocks = valueBlock.Relationships?.find((r: any) => r.Type === 'CHILD')?.Ids || [];
        value = valueTextBlocks
          .map((id: string) => {
            const block = blocks.find((b) => b.Id === id);
            return block?.Text || '';
          })
          .join(' ')
          .trim();
      }

      if (key) {
        forms.push({
          key,
          value,
          confidence: keyBlock.Confidence ? keyBlock.Confidence / 100 : 0.9,
        });
      }
    }

    return forms;
  }

  /**
   * Cleanup workers (call this when shutting down)
   */
  async cleanup(): Promise<void> {
    for (const [key, worker] of this.workers.entries()) {
      try {
        await worker.terminate();
      } catch (error) {
        console.error(`Error terminating worker ${key}:`, error);
      }
    }
    this.workers.clear();
  }
}

// Export singleton instance
export const ocrService = new OCRService();

