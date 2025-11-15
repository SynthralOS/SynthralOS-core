import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Stealth Middleware Service
 * 
 * Provides anti-bot detection evasion features:
 * - User-agent rotation
 * - Canvas fingerprint spoofing
 * - WebGL fingerprint spoofing
 * - Timezone spoofing
 * - Language spoofing
 * - Viewport randomization
 */

export interface StealthConfig {
  rotateUserAgent?: boolean;
  spoofCanvas?: boolean;
  spoofWebGL?: boolean;
  spoofTimezone?: boolean;
  spoofLanguage?: boolean;
  randomizeViewport?: boolean;
  customUserAgent?: string;
  timezone?: string;
  language?: string;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface StealthScripts {
  userAgent?: string;
  scripts: string[]; // JavaScript to inject for stealth
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * Common user agents for rotation
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

export class StealthMiddleware {
  /**
   * Generate stealth configuration for browser
   */
  generateStealthConfig(config: StealthConfig = {}): StealthScripts {
    const tracer = trace.getTracer('sos-stealth-middleware');
    const span = tracer.startSpan('stealth.generate_config', {
      attributes: {
        'stealth.rotate_ua': config.rotateUserAgent || false,
        'stealth.spoof_canvas': config.spoofCanvas || false,
        'stealth.spoof_webgl': config.spoofWebGL || false,
      },
    });

    try {
      const scripts: string[] = [];
      let userAgent: string | undefined;
      let viewport: { width: number; height: number } | undefined;

      // User agent rotation
      if (config.rotateUserAgent || config.customUserAgent) {
        userAgent = config.customUserAgent || USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        span.setAttributes({
          'stealth.user_agent': userAgent,
        });
      }

      // Canvas fingerprint spoofing
      if (config.spoofCanvas) {
        scripts.push(`
          // Canvas fingerprint spoofing
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function(type) {
            if (type === 'image/png' || !type) {
              const context = this.getContext('2d');
              if (context) {
                const imageData = context.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                  imageData.data[i] += Math.floor(Math.random() * 3) - 1;
                }
                context.putImageData(imageData, 0, 0);
              }
            }
            return originalToDataURL.apply(this, arguments);
          };
        `);
      }

      // WebGL fingerprint spoofing
      if (config.spoofWebGL) {
        scripts.push(`
          // WebGL fingerprint spoofing
          const getParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) {
              return 'Intel Inc.';
            }
            if (parameter === 37446) {
              return 'Intel Iris OpenGL Engine';
            }
            return getParameter.apply(this, arguments);
          };
        `);
      }

      // Timezone spoofing
      if (config.spoofTimezone && config.timezone) {
        scripts.push(`
          // Timezone spoofing
          const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
          Date.prototype.getTimezoneOffset = function() {
            // Return offset for specified timezone
            return ${this.getTimezoneOffset(config.timezone!)};
          };
        `);
      }

      // Language spoofing
      if (config.spoofLanguage && config.language) {
        scripts.push(`
          // Language spoofing
          Object.defineProperty(navigator, 'language', {
            get: () => '${config.language}'
          });
          Object.defineProperty(navigator, 'languages', {
            get: () => ['${config.language}', '${config.language.split('-')[0]}']
          });
        `);
      }

      // Viewport randomization
      if (config.randomizeViewport) {
        const widths = [1920, 1366, 1536, 1440, 1280];
        const heights = [1080, 768, 864, 900, 720];
        viewport = {
          width: widths[Math.floor(Math.random() * widths.length)],
          height: heights[Math.floor(Math.random() * heights.length)],
        };
        span.setAttributes({
          'stealth.viewport_width': viewport.width,
          'stealth.viewport_height': viewport.height,
        });
      } else if (config.viewport) {
        viewport = config.viewport;
      }

      span.setAttributes({
        'stealth.scripts_count': scripts.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return {
        userAgent,
        scripts,
        viewport,
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
      throw error;
    }
  }

  /**
   * Get timezone offset for a timezone
   */
  private getTimezoneOffset(timezone: string): number {
    // Simplified timezone offset calculation
    // In production, use a proper timezone library
    const offsets: Record<string, number> = {
      'UTC': 0,
      'America/New_York': 300, // EST/EDT
      'America/Los_Angeles': 480, // PST/PDT
      'Europe/London': 0, // GMT/BST
      'Europe/Paris': -60, // CET/CEST
      'Asia/Tokyo': -540, // JST
      'Asia/Shanghai': -480, // CST
    };
    return offsets[timezone] || 0;
  }

  /**
   * Inject stealth scripts into page
   */
  async injectStealthScripts(
    page: any, // Playwright Page or Puppeteer Page
    engine: 'playwright' | 'puppeteer',
    stealthScripts: StealthScripts
  ): Promise<void> {
    if (engine === 'playwright') {
      // Playwright: Add init script
      await page.addInitScript(stealthScripts.scripts.join('\n'));
    } else {
      // Puppeteer: Evaluate before navigation
      await page.evaluateOnNewDocument(stealthScripts.scripts.join('\n'));
    }
  }
}

export const stealthMiddleware = new StealthMiddleware();

