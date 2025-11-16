/**
 * Alert System Test Script
 * 
 * This script tests the alert system API endpoints.
 * 
 * How to get your token:
 * 1. Open browser and navigate to http://localhost:3000
 * 2. Login to the platform
 * 3. Open browser DevTools (F12 or Cmd+Option+I)
 * 4. Go to Network tab
 * 5. Make any API request (e.g., navigate to /workflows)
 * 6. Click on the request in Network tab
 * 7. Look at Request Headers
 * 8. Find "Authorization" header - it will look like: "Bearer eyJhbGc..."
 * 9. Copy the token part (everything after "Bearer ")
 * 
 * Usage:
 * export TOKEN="eyJhbGc..." (paste your actual token)
 * node test-alerts.js
 * 
 * OR test via UI:
 * 1. Navigate to http://localhost:3000/alerts
 * 2. Use the UI to create and manage alerts
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';
const TOKEN = process.env.TOKEN || '';

if (!TOKEN || TOKEN === 'your-token') {
  console.error('❌ Error: TOKEN environment variable not set or using placeholder');
  console.log('\n📋 How to get your token:');
  console.log('1. Open browser and navigate to http://localhost:3000');
  console.log('2. Login to the platform');
  console.log('3. Open browser DevTools (F12 or Cmd+Option+I)');
  console.log('4. Go to Network tab');
  console.log('5. Make any API request (e.g., navigate to /workflows)');
  console.log('6. Click on the request in Network tab');
  console.log('7. Look at Request Headers');
  console.log('8. Find "Authorization" header');
  console.log('9. Copy the token part (everything after "Bearer ")');
  console.log('\n💡 Alternative: Test via UI at http://localhost:3000/alerts');
  console.log('\nThen run:');
  console.log('export TOKEN="your-actual-token-here"');
  console.log('node test-alerts.js');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

let createdAlertId = null;

async function testCreateAlert() {
  console.log('\n=== Test 1: Create Failure Alert ===');
  try {
    const response = await axios.post(`${BASE_URL}/alerts`, {
      name: 'Test Failure Alert',
      description: 'Test alert for workflow failures',
      type: 'failure',
      conditions: [
        {
          metric: 'failure_rate',
          operator: '>',
          threshold: 10,
          timeWindow: 60,
        },
      ],
      notificationChannels: [
        {
          type: 'email',
          config: {
            email: 'test@example.com',
          },
        },
      ],
      cooldownMinutes: 60,
    }, { headers });

    console.log('✅ Alert created successfully');
    console.log('Alert ID:', response.data.id);
    createdAlertId = response.data.id;
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create alert:', error.response?.data || error.message);
    throw error;
  }
}

async function testListAlerts() {
  console.log('\n=== Test 2: List All Alerts ===');
  try {
    const response = await axios.get(`${BASE_URL}/alerts`, { headers });
    console.log('✅ Alerts retrieved successfully');
    console.log(`Found ${response.data.length} alerts`);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to list alerts:', error.response?.data || error.message);
    throw error;
  }
}

async function testGetAlert(alertId) {
  console.log('\n=== Test 3: Get Alert Details ===');
  try {
    const response = await axios.get(`${BASE_URL}/alerts/${alertId}`, { headers });
    console.log('✅ Alert retrieved successfully');
    console.log('Alert:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get alert:', error.response?.data || error.message);
    throw error;
  }
}

async function testToggleAlert(alertId) {
  console.log('\n=== Test 4: Toggle Alert ===');
  try {
    // Disable
    const disableResponse = await axios.patch(
      `${BASE_URL}/alerts/${alertId}/toggle`,
      { enabled: false },
      { headers }
    );
    console.log('✅ Alert disabled');
    console.log('Enabled:', disableResponse.data.enabled);

    // Enable
    const enableResponse = await axios.patch(
      `${BASE_URL}/alerts/${alertId}/toggle`,
      { enabled: true },
      { headers }
    );
    console.log('✅ Alert enabled');
    console.log('Enabled:', enableResponse.data.enabled);
    return enableResponse.data;
  } catch (error) {
    console.error('❌ Failed to toggle alert:', error.response?.data || error.message);
    throw error;
  }
}

async function testUpdateAlert(alertId) {
  console.log('\n=== Test 5: Update Alert ===');
  try {
    const response = await axios.put(
      `${BASE_URL}/alerts/${alertId}`,
      {
        name: 'Updated Test Failure Alert',
        description: 'Updated description',
        cooldownMinutes: 30,
      },
      { headers }
    );
    console.log('✅ Alert updated successfully');
    console.log('Updated name:', response.data.name);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to update alert:', error.response?.data || error.message);
    throw error;
  }
}

async function testGetAlertHistory(alertId) {
  console.log('\n=== Test 6: Get Alert History ===');
  try {
    const response = await axios.get(`${BASE_URL}/alerts/${alertId}/history`, { headers });
    console.log('✅ Alert history retrieved successfully');
    console.log(`Found ${response.data.length} history entries`);
    if (response.data.length > 0) {
      console.log('Latest entry:', JSON.stringify(response.data[0], null, 2));
    }
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get alert history:', error.response?.data || error.message);
    throw error;
  }
}

async function testCreatePerformanceAlert() {
  console.log('\n=== Test 7: Create Performance Alert ===');
  try {
    const response = await axios.post(`${BASE_URL}/alerts`, {
      name: 'Test Performance Alert',
      description: 'Test alert for slow workflows',
      type: 'performance',
      conditions: [
        {
          metric: 'execution_time',
          operator: '>',
          threshold: 5000, // 5 seconds
        },
      ],
      notificationChannels: [
        {
          type: 'webhook',
          config: {
            webhookUrl: 'https://webhook.site/your-unique-url',
          },
        },
      ],
      cooldownMinutes: 30,
    }, { headers });

    console.log('✅ Performance alert created successfully');
    console.log('Alert ID:', response.data.id);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to create performance alert:', error.response?.data || error.message);
    throw error;
  }
}

async function testDeleteAlert(alertId) {
  console.log('\n=== Test 8: Delete Alert ===');
  try {
    await axios.delete(`${BASE_URL}/alerts/${alertId}`, { headers });
    console.log('✅ Alert deleted successfully');
  } catch (error) {
    console.error('❌ Failed to delete alert:', error.response?.data || error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🚀 Starting Alert System Tests');
  console.log('================================\n');

  try {
    // Test 1: Create alert
    const alert = await testCreateAlert();
    createdAlertId = alert.id;

    // Test 2: List alerts
    await testListAlerts();

    // Test 3: Get alert
    await testGetAlert(createdAlertId);

    // Test 4: Toggle alert
    await testToggleAlert(createdAlertId);

    // Test 5: Update alert
    await testUpdateAlert(createdAlertId);

    // Test 6: Get alert history
    await testGetAlertHistory(createdAlertId);

    // Test 7: Create performance alert
    const perfAlert = await testCreatePerformanceAlert();

    // Test 8: Delete performance alert
    await testDeleteAlert(perfAlert.id);

    console.log('\n================================');
    console.log('✅ All tests passed!');
    console.log(`\nNote: Alert ${createdAlertId} was created but not deleted.`);
    console.log('You can delete it manually or test alert triggering with it.');
  } catch (error) {
    console.log('\n================================');
    console.error('❌ Tests failed');
    process.exit(1);
  }
}

// Run tests
runTests();

