# Web Scraping Guide

This guide explains how to use the web scraping feature in SynthralOS to extract data from websites.

## Overview

The web scraping feature allows you to:
- Extract data from static HTML pages
- Scrape JavaScript-rendered content (SPAs, React, Vue, Angular)
- Use proxies to avoid rate limits and IP bans
- Automatically heal broken selectors
- Monitor pages for changes

## Basic Usage

### 1. Add a Web Scrape Node

1. Open your workflow in the workflow builder
2. Click "Add Node" and select "Web Scrape" from the action nodes
3. Configure the node (see Configuration below)

### 2. Basic Configuration

#### Required Fields

- **URL**: The URL of the webpage to scrape
  - Example: `https://example.com/products`

#### Optional Fields

- **Selectors**: CSS selectors for data extraction
  - Format: `{ "fieldName": "css.selector" }`
  - Example: `{ "title": "h1.product-title", "price": ".price" }`
  
- **Extract Text**: Extract text content (default: `true`)
- **Extract HTML**: Extract raw HTML (default: `false`)
- **Extract Attributes**: Extract specific attributes
  - Example: `["href", "src", "data-id"]`

### 3. Example: Scraping Product Information

```json
{
  "url": "https://example.com/product/123",
  "selectors": {
    "title": "h1.product-title",
    "price": ".price",
    "description": ".product-description",
    "image": "img.product-image"
  },
  "extractText": true,
  "extractAttributes": ["src"]
}
```

**Output:**
```json
{
  "data": {
    "title": "Product Name",
    "price": "$99.99",
    "description": "Product description...",
    "image": "https://example.com/image.jpg"
  }
}
```

## JavaScript Rendering

For JavaScript-rendered content (SPAs, React, Vue, Angular), enable JavaScript rendering:

### Configuration

- **Render JavaScript**: Enable Puppeteer for JavaScript rendering
  - Auto-detected if not set
  - Set to `true` to force Puppeteer
  - Set to `false` to force Cheerio (faster for static HTML)

### Advanced Puppeteer Options

- **Wait For Selector**: CSS selector to wait for before scraping
  - Example: `".product-list"`
  
- **Wait For Timeout**: Timeout for waitForSelector (default: 30000ms)

- **Execute JavaScript**: Custom JavaScript to execute in page context
  - Example: `"window.scrollTo(0, document.body.scrollHeight)"`

- **Scroll To Bottom**: Scroll to bottom to load dynamic content (default: `false`)

- **Viewport**: Viewport dimensions
  - Example: `{ "width": 1920, "height": 1080 }`

- **Screenshot**: Take screenshot of the page (default: `false`)
  - Returns base64-encoded image in output

### Example: Scraping a React SPA

```json
{
  "url": "https://spa.example.com/products",
  "selectors": {
    "products": ".product-item"
  },
  "renderJavaScript": true,
  "waitForSelector": ".product-list",
  "scrollToBottom": true
}
```

## Proxy Settings

Use proxies to avoid rate limits and IP bans:

### Configuration

- **Use Proxy**: Enable proxy for requests (default: `false`)

- **Proxy Options**: Proxy selection options
  - `country`: Filter proxies by country (ISO 3166-1 alpha-2)
  - `city`: Filter proxies by city
  - `type`: Filter proxies by type (`residential`, `datacenter`, `mobile`, `isp`)
  - `minScore`: Minimum proxy score (0-100, default: 70)

- **Proxy ID**: Specific proxy ID to use (overrides `proxyOptions`)

### Example: Using a Proxy

```json
{
  "url": "https://example.com/data",
  "selectors": {
    "data": ".data-item"
  },
  "useProxy": true,
  "proxyOptions": {
    "country": "US",
    "type": "residential",
    "minScore": 80
  }
}
```

## Advanced Options

### Timeout and Retries

- **Timeout**: Request timeout in milliseconds (default: 30000)
- **Retries**: Number of retries on failure (default: 2)
- **Retry Delay**: Delay between retries in milliseconds (default: 1000)

### Custom Headers

- **Headers**: Custom HTTP headers
  - Example: `{ "Authorization": "Bearer token", "User-Agent": "CustomBot/1.0" }`

- **User Agent**: Custom user agent (default: `SynthralOS/1.0 (Web Scraper)`)

## Output

The web scrape node returns:

```json
{
  "data": {
    // Extracted data based on selectors
  },
  "html": "Raw HTML (if extractHtml is true)",
  "screenshot": "Base64 screenshot (if screenshot is true, Puppeteer only)",
  "url": "Scraped URL",
  "metadata": {
    "latency": 1234,
    "contentLength": 56789,
    "contentType": "text/html",
    "statusCode": 200,
    "engine": "cheerio" // or "puppeteer"
  }
}
```

## Self-Healing Selectors

The platform automatically tracks selector success rates and heals broken selectors:

- **Automatic Tracking**: Every selector usage is tracked
- **Failure Detection**: Monitors failure rates (threshold: 30%)
- **Automatic Healing**: Replaces failing selectors with working ones

No configuration needed - this happens automatically!

## Change Detection

Monitor web pages for changes:

1. Create a change detection monitor (via API or UI)
2. Configure check interval (default: 3600 seconds)
3. Platform automatically detects changes
4. Trigger workflows when changes are detected

## Best Practices

1. **Use Specific Selectors**: Prefer specific CSS selectors over generic ones
   - Good: `".product-title"`
   - Bad: `"div"`

2. **Enable JavaScript Only When Needed**: JavaScript rendering is slower
   - Use Cheerio for static HTML
   - Use Puppeteer for SPAs and dynamic content

3. **Use Proxies for High-Volume Scraping**: Avoid rate limits and IP bans

4. **Set Appropriate Timeouts**: Balance between reliability and speed

5. **Handle Errors**: Use retry settings and error handling in workflows

6. **Respect robots.txt**: Always check and respect website robots.txt files

7. **Rate Limiting**: Don't scrape too frequently from the same domain

## Troubleshooting

### Selector Not Finding Elements

- Check if the page requires JavaScript rendering
- Verify the selector is correct (use browser DevTools)
- Check if the page structure has changed

### Timeout Errors

- Increase the timeout value
- Check if the page is slow to load
- Consider using `waitForSelector` for dynamic content

### Rate Limiting / IP Bans

- Enable proxy usage
- Increase retry delay
- Reduce scraping frequency

### JavaScript Rendering Issues

- Verify `renderJavaScript` is enabled
- Use `waitForSelector` to wait for content
- Check if custom JavaScript execution is needed

## API Reference

See [WEB_SCRAPING_API.md](../docs/WEB_SCRAPING_API.md) for detailed API documentation.

## Examples

See [examples/scraping-workflows/](../examples/scraping-workflows/) for example workflows.

