# Web Scraping API Documentation

**Version:** 1.0  
**Last Updated:** 2024-12-19

---

## Overview

The Web Scraping feature allows you to extract data from web pages using CSS selectors. It's available as a workflow node (`action.web_scrape`) that can be used in any workflow.

---

## Node Type

**Type:** `action.web_scrape`  
**Category:** Action  
**Icon:** Globe

---

## Configuration

### Required Fields

- **`url`** (string): The URL to scrape

### Optional Fields

- **`selectors`** (object): CSS selectors for data extraction
  - Format: `{ "fieldName": "css.selector" }`
  - Example: `{ "title": "h1", "description": ".description", "price": ".price" }`
  
- **`extractText`** (boolean): Extract text content (default: `true`)
  
- **`extractHtml`** (boolean): Extract raw HTML (default: `false`)
  
- **`extractAttributes`** (array): Extract specific attributes
  - Example: `["href", "src", "data-id"]`
  
- **`timeout`** (number): Request timeout in milliseconds (default: `30000`)
  
- **`headers`** (object): Custom HTTP headers
  - Example: `{ "Authorization": "Bearer token" }`
  
- **`userAgent`** (string): Custom user agent (default: `SynthralOS/1.0 (Web Scraper)`)
  
- **`retries`** (number): Number of retries on failure (default: `2`)
  
- **`retryDelay`** (number): Delay between retries in milliseconds (default: `1000`)
  
- **`renderJavaScript`** (boolean): Use Puppeteer for JavaScript rendering (default: `undefined` - auto-detected)
  
- **`waitForSelector`** (string): CSS selector to wait for before scraping (Puppeteer only)
  
- **`waitForTimeout`** (number): Timeout for waitForSelector in milliseconds (default: `30000`)
  
- **`executeJavaScript`** (string): Custom JavaScript to execute in page context (Puppeteer only)
  
- **`scrollToBottom`** (boolean): Scroll to bottom to load dynamic content (Puppeteer only, default: `false`)
  
- **`viewport`** (object): Viewport dimensions for Puppeteer
  - `width` (number): Viewport width (default: `1920`)
  - `height` (number): Viewport height (default: `1080`)
  
- **`screenshot`** (boolean): Take screenshot of the page (Puppeteer only, default: `false`)

---

## Output

The node returns an object with the following structure:

```typescript
{
  data: {
    // Extracted data based on selectors
    // If selectors were provided, keys match selector field names
    // If no selectors, contains 'text' and optionally 'html'
  },
  html?: string, // Raw HTML (if extractHtml is true)
  screenshot?: string, // Base64 screenshot (if screenshot is true, Puppeteer only)
  url: string, // Scraped URL
  metadata: {
    latency: number, // Request latency in ms
    contentLength: number, // HTML content length
    contentType: string, // Response content type
    statusCode: number, // HTTP status code
    engine?: string // 'cheerio' or 'puppeteer'
  }
}
```

---

## Examples

### Example 1: Extract Title and Description

**Configuration:**
```json
{
  "url": "https://example.com",
  "selectors": {
    "title": "h1",
    "description": ".description"
  }
}
```

**Output:**
```json
{
  "data": {
    "title": "Example Title",
    "description": "Example description text"
  },
  "url": "https://example.com",
  "metadata": {
    "latency": 250,
    "contentLength": 5000,
    "contentType": "text/html",
    "statusCode": 200
  }
}
```

### Example 2: Extract Links

**Configuration:**
```json
{
  "url": "https://example.com",
  "selectors": {
    "links": "a"
  },
  "extractAttributes": ["href"]
}
```

**Output:**
```json
{
  "data": {
    "links": [
      { "text": "Home", "href": "/" },
      { "text": "About", "href": "/about" }
    ]
  },
  "url": "https://example.com",
  "metadata": { ... }
}
```

### Example 3: Extract All Text

**Configuration:**
```json
{
  "url": "https://example.com"
}
```

**Output:**
```json
{
  "data": {
    "text": "All text content from the page..."
  },
  "url": "https://example.com",
  "metadata": { ... }
}
```

### Example 4: Scrape JavaScript-Rendered Content

**Configuration:**
```json
{
  "url": "https://spa-example.com",
  "renderJavaScript": true,
  "waitForSelector": ".content-loaded",
  "selectors": {
    "title": "h1",
    "items": ".item"
  }
}
```

**Output:**
```json
{
  "data": {
    "title": "Dynamic Title",
    "items": ["Item 1", "Item 2", "Item 3"]
  },
  "url": "https://spa-example.com",
  "metadata": {
    "latency": 2500,
    "contentLength": 15000,
    "contentType": "text/html",
    "statusCode": 200,
    "engine": "puppeteer"
  }
}
```

### Example 5: Take Screenshot

**Configuration:**
```json
{
  "url": "https://example.com",
  "renderJavaScript": true,
  "screenshot": true
}
```

**Output:**
```json
{
  "data": { "text": "..." },
  "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "url": "https://example.com",
  "metadata": { ... }
}
```

---

## Error Handling

The node includes automatic retry logic:
- **Default retries:** 2 attempts
- **Retry delay:** 1 second (exponential backoff)
- **4xx errors:** Not retried (client errors)
- **5xx errors:** Retried automatically

### Error Output

If scraping fails, the node returns:
```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "SCRAPING_ERROR",
    "details": {
      "url": "https://example.com",
      "metadata": { ... }
    }
  }
}
```

---

## Use Cases

1. **Price Monitoring**: Scrape competitor pricing pages
2. **Content Aggregation**: Collect articles from news sites
3. **Data Extraction**: Extract structured data from websites
4. **Link Collection**: Gather all links from a page
5. **Text Analysis**: Extract text for LLM processing
6. **SPA Scraping**: Scrape JavaScript-rendered single-page applications
7. **Dynamic Content**: Extract content that loads after page load
8. **Screenshot Capture**: Take screenshots of web pages
9. **Interactive Sites**: Scrape sites requiring user interaction

---

## Limitations

### Current Limitations (Phase 2)

- **No authentication**: Basic HTTP requests only
- **No cookies/sessions**: Each request is independent
- **No pagination**: Single page scraping only
- **No proxy rotation**: Direct requests only

### Coming Soon (Phase 3+)

- Authentication support
- Pagination handling
- Proxy rotation
- Self-healing selectors
- Multi-page crawling

---

## Best Practices

1. **Use specific selectors**: More specific selectors are more reliable
2. **Handle errors**: Always check `success` field in output
3. **Set timeouts**: Adjust timeout based on site response time
4. **Respect rate limits**: Add delays between requests if scraping multiple pages
5. **Test selectors**: Use browser DevTools to test CSS selectors before using them
6. **Let auto-detection work**: Don't set `renderJavaScript` unless you know the site needs it
7. **Use waitForSelector**: For dynamic content, wait for specific elements to appear
8. **Scroll for lazy loading**: Use `scrollToBottom` for infinite scroll pages
9. **Monitor performance**: Puppeteer is slower but necessary for SPAs

---

## CSS Selector Tips

- **Class selector**: `.class-name`
- **ID selector**: `#id-name`
- **Element selector**: `div`, `p`, `h1`
- **Attribute selector**: `[data-id="123"]`
- **Descendant selector**: `.container .item`
- **Multiple elements**: Returns array if multiple matches

---

## Observability

All scraping operations are tracked:
- **OpenTelemetry**: Traces with latency and success metrics
- **PostHog**: Event tracking for analytics
- **Database**: Events logged to `scraper_events` table

---

## API Reference

### ScraperService

```typescript
import { scraperService } from './services/scraperService';

const result = await scraperService.scrape({
  url: 'https://example.com',
  selectors: {
    title: 'h1',
    description: '.description'
  }
}, {
  organizationId: 'org_123',
  workspaceId: 'ws_123',
  userId: 'user_123'
});
```

---

**Last Updated:** 2024-12-19

