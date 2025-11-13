import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ocrService, OCRInput, OCRConfig } from '../ocrService';

export async function executeFile(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const operation = (input.operation as string) || (nodeConfig.operation as string) || 'read';
  const filePath = (input.path as string) || (nodeConfig.path as string) || '';
  const content = (input.content as string) || '';
  const encoding = (nodeConfig.encoding as string) || 'utf8';

  if (!filePath) {
    return {
      success: false,
      error: {
        message: 'File path is required',
        code: 'MISSING_PATH',
      },
    };
  }

  // Security: Prevent path traversal
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(process.cwd()) && !resolvedPath.startsWith('/tmp')) {
    return {
      success: false,
      error: {
        message: 'Invalid file path: path traversal not allowed',
        code: 'INVALID_PATH',
      },
    };
  }

  try {
    switch (operation) {
      case 'read': {
        const fileContent = await fs.readFile(resolvedPath, encoding as BufferEncoding);
        const enableOCR = (nodeConfig.ocr as boolean) || false;
        
        // If OCR is enabled and file is image or PDF, run OCR
        if (enableOCR) {
          const ext = path.extname(resolvedPath).toLowerCase();
          const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'].includes(ext);
          const isPDF = ext === '.pdf';
          
          if (isImage || isPDF) {
            try {
              const fileBuffer = await fs.readFile(resolvedPath);
              const base64Content = fileBuffer.toString('base64');
              const mimeType = isPDF ? 'application/pdf' : `image/${ext.slice(1)}`;
              const dataUri = `data:${mimeType};base64,${base64Content}`;
              
              const ocrInput: OCRInput = isPDF
                ? { pdfBase64: dataUri }
                : { imageBase64: dataUri };
              
              const ocrConfig: OCRConfig = {
                provider: (nodeConfig.ocrProvider as string) || 'tesseract',
                language: (nodeConfig.ocrLanguage as string) || 'auto',
                preprocess: (nodeConfig.ocrPreprocess as boolean) !== false,
                extractTables: (nodeConfig.ocrExtractTables as boolean) || false,
                extractForms: (nodeConfig.ocrExtractForms as boolean) || false,
              };
              
              const ocrResult = await ocrService.process(ocrInput, ocrConfig);
              
              return {
                success: true,
                output: {
                  content: fileContent,
                  path: resolvedPath,
                  ocrText: ocrResult.text,
                  ocrConfidence: ocrResult.confidence,
                  ocrMetadata: ocrResult.metadata,
                  ocrStructuredData: ocrResult.structuredData,
                },
              };
            } catch (error: any) {
              // If OCR fails, return file content without OCR data
              console.warn(`OCR failed for file ${resolvedPath}:`, error.message);
              return {
                success: true,
                output: {
                  content: fileContent,
                  path: resolvedPath,
                  ocrError: error.message,
                },
              };
            }
          }
        }
        
        return {
          success: true,
          output: {
            content: fileContent,
            path: resolvedPath,
          },
        };
      }

      case 'write': {
        const writeContent = content || (input.content as string) || '';
        if (!writeContent) {
          return {
            success: false,
            error: {
              message: 'Content is required for write operation',
              code: 'MISSING_CONTENT',
            },
          };
        }
        await fs.writeFile(resolvedPath, writeContent, encoding as BufferEncoding);
        return {
          success: true,
          output: {
            success: true,
            path: resolvedPath,
          },
        };
      }

      case 'list': {
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
        const files = entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: path.join(resolvedPath, entry.name),
        }));
        return {
          success: true,
          output: {
            files,
            path: resolvedPath,
          },
        };
      }

      case 'delete': {
        await fs.unlink(resolvedPath);
        return {
          success: true,
          output: {
            success: true,
            path: resolvedPath,
          },
        };
      }

      default:
        return {
          success: false,
          error: {
            message: `Unsupported operation: ${operation}`,
            code: 'UNSUPPORTED_OPERATION',
          },
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'File operation failed',
        code: 'FILE_OPERATION_ERROR',
        details: error,
      },
    };
  }
}

