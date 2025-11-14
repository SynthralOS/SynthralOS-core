import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { db } from '../config/database';
import { scraperEvents } from '../../drizzle/schema';
import { scraperRouter } from './scraperRouter';
import { proxyService, ProxyConfig, ProxySelectionOptions } from './proxyService';
import { selectorHealingService } from './selectorHealingService';

/**
 * Web Scraper Service
 * 
 * Provides web scraping capabilities with HTML parsing using Cheerio.
 * Supports CSS selectors, text extraction, HTML extraction, and attribute extraction.
 */

export interface ScrapeConfig {
  url: string;
  selectors?: {
    [key: string]: string; // field_name: css_selector
  };
  extractText?: boolean; // Extract text content (default: true)
  extractHtml?: boolean; // Extract raw HTML (default: false)
  extractAttributes?: string[]; // Extract specific attributes (e.g., ['href', 'src'])
  timeout?: number; // Request timeout in ms (default: 30000)
  headers?: Record<string, string>; // Custom headers
  userAgent?: string; // Custom user agent
  retries?: number; // Number of retries on failure (default: 2)
  retryDelay?: number; // Delay between retries in ms (default: 1000)
  // Puppeteer-specific options
  renderJavaScript?: boolean; // Use Puppeteer for JS rendering (default: false)
  waitForSelector?: string; // Wait for selector before scraping
  waitForTimeout?: number; // Wait timeout in ms (default: 30000)
  executeJavaScript?: string; // Custom JavaScript to execute in page context
  scrollToBottom?: boolean; // Scroll to bottom to load dynamic content
  viewport?: {
    width?: number;
    height?: number;
  };
  screenshot?: boolean; // Take screenshot (returns base64)
  // Proxy options
  useProxy?: boolean; // Use proxy for requests (default: false)
  proxyOptions?: ProxySelectionOptions; // Proxy selection options
  proxyId?: string; // Specific proxy ID to use (optional)
}

export interface ScrapeResult {
  success: boolean;
  url: string;
  data: Record<string, any>; // Extracted data based on selectors
  html?: string; // Raw HTML (if extractHtml is true)
  screenshot?: string; // Base64 screenshot (if screenshot is true)
  error?: string;
  metadata: {
    latency: number; // Request latency in ms
    contentLength: number; // HTML content length
    contentType: string; // Response content type
    statusCode: number; // HTTP status code
    engine?: string; // 'cheerio' or 'puppeteer'
  };
}

export class ScraperService {
  private readonly defaultTimeout = 30000;
  private readonly defaultRetries = 2;
  private readonly defaultRetryDelay = 1000;
  private readonly defaultUserAgent = 'SynthralOS/1.0 (Web Scraper)';
  private browserPool: Browser | null = null;
  private browserPoolSize = 0;
  private readonly maxBrowserPoolSize = 3; // Maximum concurrent browsers

  /**
   * Scrape a URL and extract data using CSS selectors
   */
  async scrape(
    config: ScrapeConfig,
    context?: {
      organizationId?: string;
      workspaceId?: string;
      userId?: string;
    }
  ): Promise<ScrapeResult> {
    const tracer = trace.getTracer('sos-scraper-service');
    const span = tracer.startSpan('scraper.scrape', {
      attributes: {
        'scraper.url': config.url,
        'scraper.selectors_count': config.selectors ? Object.keys(config.selectors).length : 0,
        'scraper.extract_text': config.extractText !== false,
        'scraper.extract_html': config.extractHtml === true,
      },
    });

    const startTime = Date.now();

    try {
      // Route to appropriate scraper based on config or heuristics
      let usePuppeteer = config.renderJavaScript === true;
      
      // If not explicitly set, use router to decide
      if (config.renderJavaScript === undefined) {
        const routingDecision = await scraperRouter.route(config);
        usePuppeteer = routingDecision.engine === 'puppeteer';
        
        span.setAttributes({
          'scraper.routing_engine': routingDecision.engine,
          'scraper.routing_reason': routingDecision.reason,
          'scraper.routing_confidence': routingDecision.confidence,
        });
      }

      if (usePuppeteer) {
        return await this.scrapeWithPuppeteer(config, context, span, startTime);
      }

      // Use Cheerio for static HTML
      return await this.scrapeWithCheerio(config, context, span, startTime);
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      span.recordException(error);
      span.setAttributes({
        'scraper.latency_ms': latency,
        'scraper.success': false,
        'scraper.error': error.message,
      });
      span.setStatus({ 
        code: SpanStatusCode.ERROR,
        message: error.message,
      });

      // Log scraper event to database (async, don't wait)
      this.logScraperEvent({
        url: config.url,
        engine: config.renderJavaScript ? 'puppeteer' : 'cheerio',
        success: false,
        latencyMs: latency,
        errorMessage: error.message,
        metadata: {
          selectors: config.selectors ? Object.keys(config.selectors) : [],
        },
        organizationId: context?.organizationId,
        workspaceId: context?.workspaceId,
        userId: context?.userId,
      }).catch((err) => {
        console.error('Failed to log scraper event:', err);
      });

      span.end();

      return {
        success: false,
        url: config.url,
        data: {},
        error: error.message || 'Unknown error',
        metadata: {
          latency,
          contentLength: 0,
          contentType: '',
          statusCode: 0,
          engine: config.renderJavaScript ? 'puppeteer' : 'cheerio',
        },
      };
    }
  }

  /**
   * Scrape with Cheerio (static HTML)
   */
  private async scrapeWithCheerio(
    config: ScrapeConfig,
    context: { organizationId?: string; workspaceId?: string; userId?: string } | undefined,
    span: any,
    startTime: number
  ): Promise<ScrapeResult> {
    // Fetch HTML (with proxy support)
    const html = await this.fetchHtml(config, span, context);

    // Parse HTML with Cheerio
    const $ = cheerio.load(html);

      // Extract data based on selectors
      const data: Record<string, any> = {};
      
      if (config.selectors) {
        for (const [fieldName, selector] of Object.entries(config.selectors)) {
          try {
            const elements = $(selector);
            
            if (elements.length === 0) {
              data[fieldName] = null;
              // Record selector failure for healing (async, don't wait)
              selectorHealingService.recordSelectorUsage(
                config.url,
                fieldName,
                selector,
                'css',
                false,
                context
              ).catch(() => {});
              continue;
            }

            // Handle multiple elements
            if (elements.length > 1) {
              data[fieldName] = elements.toArray().map((el) => {
                return this.extractElementData($(el), config);
              });
            } else {
              // Single element
              data[fieldName] = this.extractElementData(elements.first(), config);
            }

            // Record selector success for healing (async, don't wait)
            const success = data[fieldName] !== null && data[fieldName] !== undefined;
            selectorHealingService.recordSelectorUsage(
              config.url,
              fieldName,
              selector,
              'css',
              success,
              context
            ).catch(() => {});
          } catch (error: any) {
            span.recordException(error);
            data[fieldName] = null;
            // Record selector failure for healing (async, don't wait)
            selectorHealingService.recordSelectorUsage(
              config.url,
              fieldName,
              selector,
              'css',
              false,
              context
            ).catch(() => {});
          }
        }
      } else {
        // No selectors specified, extract all text
        if (config.extractText !== false) {
          data.text = $.text().trim();
        }
        if (config.extractHtml === true) {
          data.html = $.html();
        }
      }

      const latency = Date.now() - startTime;

      span.setAttributes({
        'scraper.latency_ms': latency,
        'scraper.success': true,
        'scraper.content_length': html.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      const result: ScrapeResult = {
        success: true,
        url: config.url,
        data,
        html: config.extractHtml ? html : undefined,
        metadata: {
          latency,
          contentLength: html.length,
          contentType: 'text/html',
          statusCode: 200,
          engine: 'cheerio',
        },
      };

      // Log scraper event to database (async, don't wait)
      this.logScraperEvent({
        url: config.url,
        engine: 'cheerio',
        success: true,
        latencyMs: latency,
        contentLength: html.length,
        metadata: {
          selectors: config.selectors ? Object.keys(config.selectors) : [],
        },
        organizationId: context?.organizationId,
        workspaceId: context?.workspaceId,
        userId: context?.userId,
      }).catch((err) => {
        console.error('Failed to log scraper event:', err);
      });

      span.setAttributes({
        'scraper.engine': 'cheerio',
      });
      span.end();
      return result;
  }

  /**
   * Scrape with Puppeteer (JavaScript rendering)
   */
  private async scrapeWithPuppeteer(
    config: ScrapeConfig,
    context: { organizationId?: string; workspaceId?: string; userId?: string } | undefined,
    span: any,
    startTime: number
  ): Promise<ScrapeResult> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      // Get or create browser instance
      browser = await this.getBrowser();
      page = await browser.newPage();

      // Set viewport
      if (config.viewport) {
        await page.setViewport({
          width: config.viewport.width || 1920,
          height: config.viewport.height || 1080,
        });
      }

      // Set user agent
      const userAgent = config.userAgent || this.defaultUserAgent;
      await page.setUserAgent(userAgent);

      // Set extra headers
      if (config.headers) {
        await page.setExtraHTTPHeaders(config.headers);
      }

      // Configure proxy if enabled
      if (config.useProxy) {
        const proxyOptions: ProxySelectionOptions = {
          ...config.proxyOptions,
          organizationId: context?.organizationId,
        };

        const proxyConfig = config.proxyId
          ? await proxyService.getProxyById(config.proxyId)
          : await proxyService.getProxy(proxyOptions);

        if (proxyConfig) {
          // Puppeteer proxy configuration
          await page.authenticate({
            username: proxyConfig.username || '',
            password: proxyConfig.password || '',
          });

          // Note: Puppeteer doesn't directly support HTTP proxies in the same way
          // For full proxy support, you'd need to use --proxy-server launch arg
          // This is a simplified implementation
          span.setAttributes({
            'scraper.proxy_used': true,
            'scraper.proxy_host': proxyConfig.host,
          });
        }
      }

      const timeout = config.timeout || this.defaultTimeout;
      const waitForTimeout = config.waitForTimeout || timeout;

      // Navigate to URL
      await page.goto(config.url, {
        waitUntil: 'networkidle2',
        timeout,
      });

      // Wait for selector if specified
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: waitForTimeout });
      }

      // Execute custom JavaScript if specified
      if (config.executeJavaScript) {
        await page.evaluate(config.executeJavaScript);
      }

      // Scroll to bottom if requested
      if (config.scrollToBottom) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        // Wait a bit for content to load after scrolling
        await page.waitForTimeout(1000);
      }

      // Take screenshot if requested
      let screenshot: string | undefined;
      if (config.screenshot) {
        screenshot = await page.screenshot({ encoding: 'base64', fullPage: true }) as string;
      }

      // Get HTML content
      const html = await page.content();

      // Parse HTML with Cheerio
      const $ = cheerio.load(html);

      // Extract data based on selectors
      const data: Record<string, any> = {};
      
      if (config.selectors) {
        for (const [fieldName, selector] of Object.entries(config.selectors)) {
          try {
            const elements = $(selector);
            
            if (elements.length === 0) {
              data[fieldName] = null;
              // Record selector failure for healing (async, don't wait)
              selectorHealingService.recordSelectorUsage(
                config.url,
                fieldName,
                selector,
                'css',
                false,
                context
              ).catch(() => {});
              continue;
            }

            // Handle multiple elements
            if (elements.length > 1) {
              data[fieldName] = elements.toArray().map((el) => {
                return this.extractElementData($(el), config);
              });
            } else {
              // Single element
              data[fieldName] = this.extractElementData(elements.first(), config);
            }

            // Record selector success for healing (async, don't wait)
            const success = data[fieldName] !== null && data[fieldName] !== undefined;
            selectorHealingService.recordSelectorUsage(
              config.url,
              fieldName,
              selector,
              'css',
              success,
              context
            ).catch(() => {});
          } catch (error: any) {
            span.recordException(error);
            data[fieldName] = null;
            // Record selector failure for healing (async, don't wait)
            selectorHealingService.recordSelectorUsage(
              config.url,
              fieldName,
              selector,
              'css',
              false,
              context
            ).catch(() => {});
          }
        }
      } else {
        // No selectors specified, extract all text
        if (config.extractText !== false) {
          data.text = $.text().trim();
        }
        if (config.extractHtml === true) {
          data.html = html;
        }
      }

      const latency = Date.now() - startTime;

      span.setAttributes({
        'scraper.latency_ms': latency,
        'scraper.success': true,
        'scraper.content_length': html.length,
        'scraper.engine': 'puppeteer',
      });
      span.setStatus({ code: SpanStatusCode.OK });

      const result: ScrapeResult = {
        success: true,
        url: config.url,
        data,
        html: config.extractHtml ? html : undefined,
        screenshot: screenshot ? `data:image/png;base64,${screenshot}` : undefined,
        metadata: {
          latency,
          contentLength: html.length,
          contentType: 'text/html',
          statusCode: 200,
          engine: 'puppeteer',
        },
      };

      // Log scraper event to database (async, don't wait)
      this.logScraperEvent({
        url: config.url,
        engine: 'puppeteer',
        success: true,
        latencyMs: latency,
        contentLength: html.length,
        metadata: {
          selectors: config.selectors ? Object.keys(config.selectors) : [],
        },
        organizationId: context?.organizationId,
        workspaceId: context?.workspaceId,
        userId: context?.userId,
      }).catch((err) => {
        console.error('Failed to log scraper event:', err);
      });

      span.end();
      return result;
    } finally {
      // Close page but keep browser for reuse
      if (page) {
        await page.close().catch(() => {});
      }
      // Browser is kept in pool for reuse
    }
  }

  /**
   * Get or create browser instance from pool
   */
  private async getBrowser(): Promise<Browser> {
    // Simple browser pool - reuse single browser instance
    // For production, implement proper pool with multiple browsers
    if (!this.browserPool || !this.browserPool.isConnected()) {
      const launchOptions: LaunchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      };

      this.browserPool = await puppeteer.launch(launchOptions);
      this.browserPoolSize = 1;

      // Handle browser disconnection
      this.browserPool.on('disconnected', () => {
        this.browserPool = null;
        this.browserPoolSize = 0;
      });
    }

    return this.browserPool;
  }

  /**
   * Cleanup browser pool
   */
  async cleanup(): Promise<void> {
    if (this.browserPool) {
      await this.browserPool.close();
      this.browserPool = null;
      this.browserPoolSize = 0;
    }
  }

  /**
   * Log scraper event to database
   */
  private async logScraperEvent(event: {
    url: string;
    engine: string;
    success: boolean;
    latencyMs?: number;
    contentLength?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
    organizationId?: string;
    workspaceId?: string;
    userId?: string;
  }): Promise<void> {
    try {
      await db.insert(scraperEvents).values({
        url: event.url,
        engine: event.engine,
        success: event.success,
        latencyMs: event.latencyMs || null,
        contentLength: event.contentLength || null,
        errorMessage: event.errorMessage || null,
        metadata: event.metadata || null,
        organizationId: event.organizationId || null,
        workspaceId: event.workspaceId || null,
        userId: event.userId || null,
      });
    } catch (error) {
      // Silently fail - logging should not break scraping
      console.error('Failed to log scraper event:', error);
    }
  }

  /**
   * Fetch HTML from URL with retry logic and proxy support
   */
  private async fetchHtml(
    config: ScrapeConfig,
    span: any,
    context?: {
      organizationId?: string;
      workspaceId?: string;
      userId?: string;
    }
  ): Promise<string> {
    const timeout = config.timeout || this.defaultTimeout;
    const retries = config.retries ?? this.defaultRetries;
    const retryDelay = config.retryDelay || this.defaultRetryDelay;
    const userAgent = config.userAgent || this.defaultUserAgent;

    let lastError: Error | null = null;
    let usedProxyId: string | null = null;
    const excludedProxyIds: string[] = [];

    for (let attempt = 0; attempt <= retries; attempt++) {
      let proxyConfig: ProxyConfig | null = null;
      let currentProxyId: string | null = null;

      try {
        // Get proxy if enabled
        if (config.useProxy) {
          const proxyOptions: ProxySelectionOptions = {
            ...config.proxyOptions,
            organizationId: context?.organizationId,
            excludeProxyIds: excludedProxyIds.length > 0 ? excludedProxyIds : undefined,
          };

          // If specific proxy ID provided, use that
          if (config.proxyId) {
            proxyConfig = await proxyService.getProxyById(config.proxyId);
            if (proxyConfig) {
              currentProxyId = proxyConfig.id;
            }
          } else {
            // Get best available proxy
            proxyConfig = await proxyService.getProxy(proxyOptions);
          }

          if (proxyConfig) {
            usedProxyId = proxyConfig.id;
            span.setAttributes({
              'scraper.proxy_used': true,
              'scraper.proxy_id': proxyConfig.id,
              'scraper.proxy_host': proxyConfig.host,
            });
          }
        }

        const headers: Record<string, string> = {
          'User-Agent': userAgent,
          ...config.headers,
        };

        const requestConfig: AxiosRequestConfig = {
          method: 'GET',
          url: config.url,
          headers,
          timeout,
          maxRedirects: 5,
          validateStatus: (status) => status >= 200 && status < 400,
        };

        // Add proxy configuration
        if (proxyConfig) {
          const proxyUrl = proxyConfig.username && proxyConfig.password
            ? `${proxyConfig.protocol || 'http'}://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.host}:${proxyConfig.port}`
            : `${proxyConfig.protocol || 'http'}://${proxyConfig.host}:${proxyConfig.port}`;
          
          requestConfig.proxy = {
            protocol: proxyConfig.protocol || 'http',
            host: proxyConfig.host,
            port: proxyConfig.port,
            auth: proxyConfig.username && proxyConfig.password
              ? {
                  username: proxyConfig.username,
                  password: proxyConfig.password,
                }
              : undefined,
          };
        }

        const requestStartTime = Date.now();
        const response = await axios(requestConfig);
        const requestLatency = Date.now() - requestStartTime;

        // Check if response is HTML
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          throw new Error(`Expected HTML content, got ${contentType}`);
        }

        span.setAttributes({
          'scraper.attempt': attempt + 1,
          'scraper.status_code': response.status,
          'scraper.content_type': contentType,
          'scraper.latency_ms': requestLatency,
        });

        // Log proxy usage if proxy was used
        if (proxyConfig && usedProxyId) {
          proxyService.logUsage(
            usedProxyId,
            {
              success: true,
              statusCode: response.status,
              latencyMs: requestLatency,
            },
            {
              organizationId: context?.organizationId,
              workspaceId: context?.workspaceId,
              userId: context?.userId,
              url: config.url,
            }
          ).catch(() => {}); // Don't wait for logging
        }

        return response.data;
      } catch (error: any) {
        const requestLatency = Date.now() - (Date.now() - (config.timeout || this.defaultTimeout));
        lastError = error;

        // Log proxy failure if proxy was used
        if (proxyConfig && usedProxyId) {
          const banReason = error.response?.status === 403 || error.response?.status === 429
            ? `HTTP ${error.response.status}`
            : undefined;

          proxyService.logUsage(
            usedProxyId,
            {
              success: false,
              statusCode: error.response?.status,
              latencyMs: requestLatency,
              banReason,
              errorMessage: error.message,
            },
            {
              organizationId: context?.organizationId,
              workspaceId: context?.workspaceId,
              userId: context?.userId,
              url: config.url,
            }
          ).catch(() => {}); // Don't wait for logging

          // Exclude failed proxy from next attempt
          excludedProxyIds.push(usedProxyId);
        }

        // Don't retry on 4xx errors (client errors) unless it's a proxy ban
        if (error.response?.status >= 400 && error.response?.status < 500) {
          if (error.response.status === 403 || error.response.status === 429) {
            // Proxy ban - retry with different proxy
            if (attempt < retries && config.useProxy) {
              await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
              continue;
            }
          }
          throw error;
        }

        // Wait before retry (except on last attempt)
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Failed to fetch HTML after retries');
  }

  /**
   * Extract data from a Cheerio element based on config
   */
  private extractElementData(
    $element: cheerio.Cheerio<cheerio.Element>,
    config: ScrapeConfig
  ): any {
    const extractText = config.extractText !== false;
    const extractHtml = config.extractHtml === true;
    const extractAttributes = config.extractAttributes || [];

    const result: any = {};

    if (extractText) {
      result.text = $element.text().trim();
    }

    if (extractHtml) {
      result.html = $element.html() || '';
    }

    if (extractAttributes.length > 0) {
      for (const attr of extractAttributes) {
        const value = $element.attr(attr);
        if (value !== undefined) {
          result[attr] = value;
        }
      }
    }

    // If only text is requested, return just the text string
    if (extractText && !extractHtml && extractAttributes.length === 0) {
      return result.text;
    }

    // If only HTML is requested, return just the HTML string
    if (!extractText && extractHtml && extractAttributes.length === 0) {
      return result.html;
    }

    // If only one attribute is requested, return just that value
    if (!extractText && !extractHtml && extractAttributes.length === 1) {
      return result[extractAttributes[0]] || null;
    }

    // Otherwise return the full object
    return result;
  }
}

export const scraperService = new ScraperService();

