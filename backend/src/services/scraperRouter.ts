import axios from 'axios';
import { ScrapeConfig } from './scraperService';
import redis from '../config/redis';

/**
 * Scraper Router
 * 
 * Intelligently routes scraping requests to the appropriate engine
 * (Cheerio for static HTML, Puppeteer for JavaScript-rendered content)
 */

export interface RoutingHeuristics {
  htmlComplexity: 'simple' | 'medium' | 'complex';
  jsRequired: boolean;
  hasScriptTags: boolean;
  hasReactAngularVue: boolean;
  requiresInteraction: boolean;
}

export interface RoutingDecision {
  engine: 'cheerio' | 'puppeteer';
  reason: string;
  confidence: number; // 0-1
}

export class ScraperRouter {
  /**
   * Route scraping request to appropriate engine
   */
  async route(config: ScrapeConfig): Promise<RoutingDecision> {
    // If explicitly requested, use that engine
    if (config.renderJavaScript === true) {
      return {
        engine: 'puppeteer',
        reason: 'JavaScript rendering explicitly requested',
        confidence: 1.0,
      };
    }

    if (config.renderJavaScript === false) {
      return {
        engine: 'cheerio',
        reason: 'Static HTML explicitly requested',
        confidence: 1.0,
      };
    }

    // Check cache for heuristics
    const cacheKey = `scraper:heuristics:${config.url}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const cachedHeuristics = JSON.parse(cached) as RoutingHeuristics;
        const decision = this.decideEngine(cachedHeuristics, config);
        return {
          ...decision,
          reason: `${decision.reason} (cached)`,
        };
      }
    } catch (error) {
      // Cache miss or error - continue with analysis
    }

    // Analyze URL to determine best engine
    try {
      const heuristics = await this.analyzeUrl(config.url);
      
      // Cache heuristics for 1 hour
      try {
        await redis.setex(cacheKey, 3600, JSON.stringify(heuristics));
      } catch (error) {
        // Cache error - non-blocking
      }
      
      return this.decideEngine(heuristics, config);
    } catch (error) {
      // If analysis fails, default to Cheerio (faster, less resource-intensive)
      return {
        engine: 'cheerio',
        reason: 'URL analysis failed, defaulting to Cheerio',
        confidence: 0.5,
      };
    }
  }

  /**
   * Analyze URL to determine scraping requirements
   */
  private async analyzeUrl(url: string): Promise<RoutingHeuristics> {
    try {
      // Fetch initial HTML (with short timeout)
      const response = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'SynthralOS/1.0 (Web Scraper)',
        },
      });

      const html = response.data as string;
      const lowerHtml = html.toLowerCase();

      // Check for script tags
      const hasScriptTags = /<script[^>]*>/i.test(html);
      
      // Check for common JS frameworks
      const hasReactAngularVue = 
        /react|angular|vue|next\.js|nuxt/i.test(html) ||
        /__REACT_DEVTOOLS|ng-app|v-if|v-for/i.test(html);

      // Check HTML complexity
      const scriptCount = (html.match(/<script/gi) || []).length;
      const divCount = (html.match(/<div/gi) || []).length;
      const htmlComplexity: 'simple' | 'medium' | 'complex' = 
        scriptCount > 10 || divCount > 100 ? 'complex' :
        scriptCount > 3 || divCount > 50 ? 'medium' : 'simple';

      // Check for common patterns that require JS
      const jsRequired = 
        hasReactAngularVue ||
        /data-react|data-ng|v-bind|v-model/i.test(html) ||
        /window\.__INITIAL_STATE__|window\.__PRELOADED_STATE__/i.test(html) ||
        /<noscript/i.test(html) && scriptCount > 5; // Many scripts but noscript suggests JS is needed

      // Check for interaction requirements
      const requiresInteraction = 
        /onclick|onchange|onload|addEventListener/i.test(html) ||
        /button.*click|form.*submit/i.test(lowerHtml);

      return {
        htmlComplexity,
        jsRequired,
        hasScriptTags,
        hasReactAngularVue,
        requiresInteraction,
      };
    } catch (error) {
      // If fetch fails, assume complex (might need JS)
      return {
        htmlComplexity: 'complex',
        jsRequired: true,
        hasScriptTags: true,
        hasReactAngularVue: false,
        requiresInteraction: false,
      };
    }
  }

  /**
   * Decide which engine to use based on heuristics
   */
  private decideEngine(
    heuristics: RoutingHeuristics,
    config: ScrapeConfig
  ): RoutingDecision {
    // High confidence indicators for Puppeteer
    if (heuristics.hasReactAngularVue) {
      return {
        engine: 'puppeteer',
        reason: 'Detected React/Angular/Vue framework',
        confidence: 0.9,
      };
    }

    if (heuristics.jsRequired && heuristics.htmlComplexity === 'complex') {
      return {
        engine: 'puppeteer',
        reason: 'Complex HTML with JavaScript requirements detected',
        confidence: 0.8,
      };
    }

    if (heuristics.requiresInteraction && config.waitForSelector) {
      return {
        engine: 'puppeteer',
        reason: 'Interactive elements detected with waitForSelector',
        confidence: 0.85,
      };
    }

    // Medium confidence indicators
    if (heuristics.jsRequired && heuristics.hasScriptTags) {
      return {
        engine: 'puppeteer',
        reason: 'JavaScript required with multiple script tags',
        confidence: 0.7,
      };
    }

    // Default to Cheerio for simple/static content
    if (heuristics.htmlComplexity === 'simple' && !heuristics.hasScriptTags) {
      return {
        engine: 'cheerio',
        reason: 'Simple static HTML detected',
        confidence: 0.9,
      };
    }

    // Default to Cheerio if uncertain (faster, less resource-intensive)
    return {
      engine: 'cheerio',
      reason: 'Defaulting to Cheerio (faster for static content)',
      confidence: 0.6,
    };
  }
}

export const scraperRouter = new ScraperRouter();

