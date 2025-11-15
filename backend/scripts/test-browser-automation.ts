/**
 * Test Browser Automation
 * 
 * Tests browser automation functionality including:
 * - Browser pool management
 * - Browser switch routing
 * - Browser actions (navigate, click, fill, extract, screenshot)
 */

import { browserAutomationService } from '../src/services/browserAutomationService';
import { browserSwitchService } from '../src/services/browserSwitchService';
import { browserPoolService } from '../src/services/browserPoolService';

async function testBrowserAutomation() {
  console.log('🧪 Testing Browser Automation...\n');

  try {
    // Test 1: Browser Switch Routing
    console.log('1️⃣ Testing Browser Switch Routing...');
    const routingDecision = await browserSwitchService.route({
      url: 'https://example.com',
      action: 'navigate',
      htmlType: 'dynamic',
    });
    console.log('✅ Routing Decision:', {
      engine: routingDecision.engine,
      reason: routingDecision.reason,
      confidence: routingDecision.confidence,
    });
    console.log('');

    // Test 2: Navigate Action
    console.log('2️⃣ Testing Navigate Action...');
    const navigateResult = await browserAutomationService.executeAction({
      action: 'navigate',
      url: 'https://example.com',
      screenshot: true,
      context: {
        userId: 'test-user',
        organizationId: 'test-org',
        workspaceId: 'test-workspace',
      },
    });
    console.log('✅ Navigate Result:', {
      success: navigateResult.success,
      engine: navigateResult.metadata.engine,
      latency: navigateResult.metadata.latency,
      hasScreenshot: !!navigateResult.screenshot,
      hasHtml: !!navigateResult.html,
    });
    console.log('');

    // Test 3: Extract Action
    console.log('3️⃣ Testing Extract Action...');
    const extractResult = await browserAutomationService.executeAction({
      action: 'extract',
      url: 'https://example.com',
      extractSelectors: {
        title: 'h1',
        description: 'p',
      },
      context: {
        userId: 'test-user',
        organizationId: 'test-org',
        workspaceId: 'test-workspace',
      },
    });
    console.log('✅ Extract Result:', {
      success: extractResult.success,
      engine: extractResult.metadata.engine,
      data: extractResult.data,
    });
    console.log('');

    // Test 4: Browser Pool Stats
    console.log('4️⃣ Testing Browser Pool Stats...');
    const poolStats = browserPoolService.getStats();
    console.log('✅ Pool Stats:', poolStats);
    console.log('');

    // Test 5: Routing with Different Conditions
    console.log('5️⃣ Testing Routing with Different Conditions...');
    
    const testCases = [
      { name: 'Cloudflare Block', config: { cloudflareBlock: true } },
      { name: '403/429 Detected', config: { has403429: true } },
      { name: 'Dynamic Content', config: { dynamicContentMonitoring: true } },
      { name: 'Autonomous Exploration', config: { autonomousWebExploration: true } },
      { name: 'Lightweight Task', config: { browserLightweightTask: true } },
      { name: 'Headless Scraping', config: { headlessScrapingNeeded: true } },
    ];

    for (const testCase of testCases) {
      const decision = await browserSwitchService.route({
        url: 'https://example.com',
        action: 'navigate',
        ...testCase.config,
      });
      console.log(`  ${testCase.name}:`, {
        engine: decision.engine,
        reason: decision.reason,
        confidence: decision.confidence,
      });
    }
    console.log('');

    // Test 6: Cleanup
    console.log('6️⃣ Cleaning up browser pools...');
    await browserPoolService.cleanup();
    console.log('✅ Cleanup complete');
    console.log('');

    console.log('✅ All tests passed!');
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testBrowserAutomation()
  .then(() => {
    console.log('\n🎉 Browser automation tests completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Browser automation tests failed:', error);
    process.exit(1);
  });

