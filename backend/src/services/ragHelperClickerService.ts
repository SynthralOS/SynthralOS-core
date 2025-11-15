import { browserAutomationService, BrowserActionConfig } from './browserAutomationService';
import { langchainService } from './langchainService';
import { storeVectors } from './vectorStore';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import * as cheerio from 'cheerio';

/**
 * RAG Helper Clicker Service
 * 
 * Predefined LangGraph sub-flow for RAG workflows:
 * 1. Open page using browser automation
 * 2. Extract content (using Readability-style extraction)
 * 3. Split text using RecursiveTextSplitter
 * 4. Store chunks in vector DB
 * 
 * This is a simplified version - in production, you'd use a proper
 * Readability library or similar for better content extraction.
 */

export interface RAGHelperClickerConfig {
  url: string;
  vectorStoreId: string;
  chunkSize?: number;
  chunkOverlap?: number;
  selector?: string; // Optional CSS selector to extract specific content
  useBrowserAutomation?: boolean; // Use browser automation instead of simple fetch
  context?: {
    organizationId?: string;
    workspaceId?: string;
    userId?: string;
  };
}

export interface RAGHelperClickerResult {
  success: boolean;
  url: string;
  chunksCreated: number;
  totalTextLength: number;
  error?: string;
  metadata: {
    executionTime: number;
    extractionMethod: 'browser' | 'fetch';
  };
}

export class RAGHelperClickerService {
  /**
   * Execute RAG Helper Clicker workflow
   */
  async execute(config: RAGHelperClickerConfig): Promise<RAGHelperClickerResult> {
    const tracer = trace.getTracer('sos-rag-helper-clicker');
    const span = tracer.startSpan('rag_helper_clicker.execute', {
      attributes: {
        'rag.url': config.url,
        'rag.vector_store_id': config.vectorStoreId,
      },
    });

    const startTime = Date.now();

    try {
      let html: string;
      let extractionMethod: 'browser' | 'fetch' = 'fetch';

      // Step 1: Open page and extract content
      if (config.useBrowserAutomation) {
        // Use browser automation for JavaScript-rendered content
        const browserResult = await browserAutomationService.executeAction({
          action: 'navigate',
          url: config.url,
          context: config.context,
        });

        if (!browserResult.success || !browserResult.html) {
          throw new Error(browserResult.error || 'Failed to fetch page with browser automation');
        }

        html = browserResult.html;
        extractionMethod = 'browser';
      } else {
        // Use simple fetch (faster for static content)
        const response = await fetch(config.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
        }
        html = await response.text();
      }

      span.setAttributes({
        'rag.extraction_method': extractionMethod,
        'rag.html_length': html.length,
      });

      // Step 2: Extract main content (Readability-style)
      const extractedText = this.extractMainContent(html, config.selector);

      span.setAttributes({
        'rag.extracted_text_length': extractedText.length,
      });

      // Step 3: Split text using RecursiveTextSplitter
      const chunkSize = config.chunkSize || 1000;
      const chunkOverlap = config.chunkOverlap || 200;

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
        separators: ['\n\n', '\n', '. ', ' ', ''],
      });

      const chunks = await splitter.splitText(extractedText);

      span.setAttributes({
        'rag.chunks_count': chunks.length,
      });

      // Step 4: Store chunks in vector DB
      const organizationId = config.context?.organizationId;
      if (!organizationId) {
        throw new Error('organizationId is required for vector store operations');
      }

      const vectorStoreResults = await Promise.all(
        chunks.map(async (chunk, index) => {
          return await storeVectors({
            organizationId,
            workspaceId: config.context?.workspaceId,
            vectorStoreId: config.vectorStoreId,
            documents: [
              {
                content: chunk,
                metadata: {
                  url: config.url,
                  chunkIndex: index,
                  totalChunks: chunks.length,
                  source: 'rag_helper_clicker',
                },
              },
            ],
          });
        })
      );

      const executionTime = Date.now() - startTime;

      span.setAttributes({
        'rag.success': true,
        'rag.chunks_created': chunks.length,
        'rag.execution_time_ms': executionTime,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return {
        success: true,
        url: config.url,
        chunksCreated: chunks.length,
        totalTextLength: extractedText.length,
        metadata: {
          executionTime,
          extractionMethod,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      span.recordException(error);
      span.setAttributes({
        'rag.success': false,
        'rag.error': error.message,
        'rag.execution_time_ms': executionTime,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();

      return {
        success: false,
        url: config.url,
        chunksCreated: 0,
        totalTextLength: 0,
        error: error.message || 'Unknown error',
        metadata: {
          executionTime,
          extractionMethod: config.useBrowserAutomation ? 'browser' : 'fetch',
        },
      };
    }
  }

  /**
   * Extract main content from HTML (Readability-style)
   * Removes navigation, headers, footers, ads, etc.
   */
  private extractMainContent(html: string, selector?: string): string {
    const $ = cheerio.load(html);

    // Remove script, style, nav, header, footer, aside, ads
    $('script, style, nav, header, footer, aside, .ad, .ads, .advertisement, .sidebar').remove();

    let content: string;

    if (selector) {
      // Extract from specific selector
      const element = $(selector);
      content = element.text().trim();
    } else {
      // Try to find main content area
      const main = $('main, article, .content, .main-content, #content, #main');
      if (main.length > 0) {
        content = main.first().text().trim();
      } else {
        // Fallback to body, but remove common non-content elements
        $('body').find('nav, header, footer, aside, .nav, .header, .footer, .sidebar').remove();
        content = $('body').text().trim();
      }
    }

    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').trim();

    return content;
  }

  /**
   * Execute RAG Helper Clicker for multiple URLs
   */
  async executeBatch(
    configs: RAGHelperClickerConfig[]
  ): Promise<RAGHelperClickerResult[]> {
    const results: RAGHelperClickerResult[] = [];

    for (const config of configs) {
      const result = await this.execute(config);
      results.push(result);
    }

    return results;
  }
}

export const ragHelperClickerService = new RAGHelperClickerService();

