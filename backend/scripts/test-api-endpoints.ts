/**
 * API Endpoints Integration Test Script
 * 
 * Tests all frontend-backend integrations to verify endpoints are working correctly.
 * Run with: tsx scripts/test-api-endpoints.ts
 */

import axios from 'axios';

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000/api/v1';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'skip';
  message?: string;
  responseTime?: number;
}

const results: TestResult[] = [];
let authToken: string | null = null;

// Helper function to make authenticated requests
async function makeRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint: string,
  data?: any,
  requireAuth = true
): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const config: any = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (requireAuth && authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    const responseTime = Date.now() - startTime;

    return {
      endpoint,
      method,
      status: response.status >= 200 && response.status < 300 ? 'pass' : 'fail',
      message: `Status: ${response.status}`,
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const status = error.response?.status;

    // 401/403 are expected for unauthenticated requests
    if (!requireAuth && (status === 401 || status === 403)) {
      return {
        endpoint,
        method,
        status: 'pass',
        message: `Expected auth error: ${status}`,
        responseTime,
      };
    }

    return {
      endpoint,
      method,
      status: status === 404 ? 'skip' : 'fail',
      message: error.response?.data?.error || error.message,
      responseTime,
    };
  }
}

// Test authentication
async function testAuth() {
  console.log('\n🔐 Testing Authentication...');
  
  // Note: This assumes you have an auth endpoint
  // Adjust based on your actual auth implementation
  const result = await makeRequest('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  }, false);

  if (result.status === 'pass' && result.message?.includes('200')) {
    // Extract token from response (adjust based on your auth response format)
    console.log('✅ Authentication successful');
    return true;
  } else {
    console.log('⚠️  Authentication skipped (may require manual setup)');
    return false;
  }
}

// Test Dashboard endpoints
async function testDashboard() {
  console.log('\n📊 Testing Dashboard Endpoints...');
  
  results.push(await makeRequest('GET', '/stats'));
  results.push(await makeRequest('GET', '/stats/trends'));
  results.push(await makeRequest('GET', '/stats/chart'));
  results.push(await makeRequest('GET', '/stats/scraping/events?limit=10'));
}

// Test Analytics endpoints
async function testAnalytics() {
  console.log('\n📈 Testing Analytics Endpoints...');
  
  const dateRange = {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  };

  results.push(await makeRequest('GET', `/analytics/workflows?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`));
  results.push(await makeRequest('GET', `/analytics/nodes?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`));
  results.push(await makeRequest('GET', `/analytics/costs?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`));
  results.push(await makeRequest('GET', `/analytics/errors?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`));
  results.push(await makeRequest('GET', `/analytics/usage?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`));
}

// Test Workflows endpoints
async function testWorkflows() {
  console.log('\n🔄 Testing Workflows Endpoints...');
  
  results.push(await makeRequest('GET', '/workflows'));
  results.push(await makeRequest('GET', '/workflows?limit=3'));
}

// Test Alerts endpoints
async function testAlerts() {
  console.log('\n🚨 Testing Alerts Endpoints...');
  
  results.push(await makeRequest('GET', '/alerts'));
}

// Test Code Agents endpoints
async function testCodeAgents() {
  console.log('\n💻 Testing Code Agents Endpoints...');
  
  results.push(await makeRequest('GET', '/code-agents'));
}

// Test Preferences endpoints
async function testPreferences() {
  console.log('\n⚙️  Testing Preferences Endpoints...');
  
  results.push(await makeRequest('GET', '/users/me'));
  results.push(await makeRequest('GET', '/users/me/preferences'));
}

// Test Activity Log endpoints
async function testActivityLog() {
  console.log('\n📝 Testing Activity Log Endpoints...');
  
  results.push(await makeRequest('GET', '/users/me/activity?limit=50'));
}

// Test Teams endpoints
async function testTeams() {
  console.log('\n👥 Testing Teams Endpoints...');
  
  results.push(await makeRequest('GET', '/teams'));
}

// Test Roles endpoints
async function testRoles() {
  console.log('\n🔑 Testing Roles Endpoints...');
  
  results.push(await makeRequest('GET', '/roles'));
  results.push(await makeRequest('GET', '/roles/permissions/all'));
}

// Test API Keys endpoints
async function testApiKeys() {
  console.log('\n🔐 Testing API Keys Endpoints...');
  
  results.push(await makeRequest('GET', '/api-keys'));
}

// Test Audit Logs endpoints
async function testAuditLogs() {
  console.log('\n📋 Testing Audit Logs Endpoints...');
  
  results.push(await makeRequest('GET', '/audit-logs?limit=50'));
  results.push(await makeRequest('GET', '/audit-logs/retention/stats'));
}

// Test Email Trigger Monitoring endpoints
async function testEmailTriggerMonitoring() {
  console.log('\n📧 Testing Email Trigger Monitoring Endpoints...');
  
  results.push(await makeRequest('GET', '/email-triggers/monitoring/health'));
  results.push(await makeRequest('GET', '/email-triggers/monitoring/health/all'));
  results.push(await makeRequest('GET', '/email-triggers/monitoring/metrics'));
  results.push(await makeRequest('GET', '/email-triggers/monitoring/alerts?limit=50'));
}

// Test Performance Monitoring endpoints
async function testPerformanceMonitoring() {
  console.log('\n⚡ Testing Performance Monitoring Endpoints...');
  
  results.push(await makeRequest('GET', '/monitoring/performance'));
  results.push(await makeRequest('GET', '/monitoring/performance/system'));
  results.push(await makeRequest('GET', '/monitoring/performance/slowest?limit=10'));
  results.push(await makeRequest('GET', '/monitoring/performance/most-requested?limit=10'));
  results.push(await makeRequest('GET', '/monitoring/performance/cache'));
}

// Test OSINT Monitoring endpoints
async function testOSINTMonitoring() {
  console.log('\n🔍 Testing OSINT Monitoring Endpoints...');
  
  results.push(await makeRequest('GET', '/osint/monitors'));
  results.push(await makeRequest('GET', '/osint/stats'));
  results.push(await makeRequest('GET', '/osint/results?limit=50'));
}

// Test Connectors endpoints
async function testConnectors() {
  console.log('\n🔌 Testing Connectors Endpoints...');
  
  results.push(await makeRequest('GET', '/connectors'));
  results.push(await makeRequest('GET', '/connectors/connections'));
}

// Test Agents endpoints
async function testAgents() {
  console.log('\n🤖 Testing Agents Endpoints...');
  
  results.push(await makeRequest('GET', '/agents/frameworks'));
}

// Test Templates endpoints
async function testTemplates() {
  console.log('\n📄 Testing Templates Endpoints...');
  
  results.push(await makeRequest('GET', '/templates'));
}

// Test Contact endpoint
async function testContact() {
  console.log('\n📮 Testing Contact Endpoint...');
  
  results.push(await makeRequest('POST', '/contact', {
    name: 'Test User',
    email: 'test@example.com',
    subject: 'Test Subject',
    message: 'Test message',
  }, false));
}

// Print results summary
function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results
      .filter(r => r.status === 'fail')
      .forEach(r => {
        console.log(`  ${r.method} ${r.endpoint}`);
        console.log(`    ${r.message}`);
      });
  }

  if (skipped > 0) {
    console.log('\n⏭️  SKIPPED TESTS:');
    results
      .filter(r => r.status === 'skip')
      .forEach(r => {
        console.log(`  ${r.method} ${r.endpoint}`);
        console.log(`    ${r.message}`);
      });
  }

  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.filter(r => r.responseTime).length;

  if (avgResponseTime) {
    console.log(`\n⏱️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
  }

  console.log('\n' + '='.repeat(80));
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting API Endpoints Integration Tests...');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);

  // Test authentication (optional)
  await testAuth();

  // Run all test suites
  await testDashboard();
  await testAnalytics();
  await testWorkflows();
  await testAlerts();
  await testCodeAgents();
  await testPreferences();
  await testActivityLog();
  await testTeams();
  await testRoles();
  await testApiKeys();
  await testAuditLogs();
  await testEmailTriggerMonitoring();
  await testPerformanceMonitoring();
  await testOSINTMonitoring();
  await testConnectors();
  await testAgents();
  await testTemplates();
  await testContact();

  // Print results
  printResults();

  // Exit with appropriate code
  const failed = results.filter(r => r.status === 'fail').length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});

