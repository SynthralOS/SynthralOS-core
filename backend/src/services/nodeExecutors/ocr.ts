import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { ocrService, OCRInput, OCRConfig } from '../ocrService';

/**
 * OCR Node Executor
 * Extracts text from images, PDFs, or scanned documents
 */
export async function executeOCR(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  // Extract configuration
  const provider = (nodeConfig.provider as string) || 'tesseract';
  const language = (nodeConfig.language as string) || 'eng';
  const extractTables = (nodeConfig.extractTables as boolean) || false;
  const extractForms = (nodeConfig.extractForms as boolean) || false;
  const preprocess = (nodeConfig.preprocess as boolean) !== false;
  const apiKey = (nodeConfig.apiKey as string) || undefined;

  // Extract input (supports multiple formats)
  const imageUrl = (input.imageUrl as string) || '';
  const imageBase64 = (input.imageBase64 as string) || '';
  const pdfUrl = (input.pdfUrl as string) || '';
  const pdfBase64 = (input.pdfBase64 as string) || '';
  const file = (input.file as string) || '';

  // Validate input
  if (!imageUrl && !imageBase64 && !pdfUrl && !pdfBase64 && !file) {
    return {
      success: false,
      error: {
        message:
          'At least one input is required: imageUrl, imageBase64, pdfUrl, pdfBase64, or file',
        code: 'MISSING_INPUT',
      },
    };
  }

  try {
    // Prepare OCR input
    const ocrInput: OCRInput = {
      imageUrl: imageUrl || undefined,
      imageBase64: imageBase64 || undefined,
      pdfUrl: pdfUrl || undefined,
      pdfBase64: pdfBase64 || undefined,
      file: file || undefined,
    };

    // Prepare OCR config
    const ocrConfig: OCRConfig = {
      provider: provider as any,
      language,
      extractTables,
      extractForms,
      preprocess,
      apiKey,
    };

    // Process with OCR service
    const result = await ocrService.process(ocrInput, ocrConfig);

    // Return formatted output
    return {
      success: true,
      output: {
        text: result.text,
        structuredData: result.structuredData,
        confidence: result.confidence,
        metadata: result.metadata,
        pages: result.pages,
      },
      metadata: {
        executionTime: result.metadata.processingTime,
        provider: result.metadata.provider,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'OCR processing failed',
        code: 'OCR_ERROR',
        details: error,
      },
    };
  }
}

