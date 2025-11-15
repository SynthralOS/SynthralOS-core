/**
 * Test script for Bacalhau execution
 * 
 * This script tests the Bacalhau execution functionality.
 * Requires Bacalhau CLI to be installed and a cluster running.
 * 
 * Run with: npx tsx scripts/test-bacalhau-execution.ts
 */

import { bacalhauRuntime } from '../src/services/runtimes/bacalhauRuntime';

async function testBacalhauExecution() {
  console.log('🧪 Testing Bacalhau Execution...\n');

  // Wait for initialization
  await bacalhauRuntime.initialize();

  // Check if Bacalhau is available
  if (!bacalhauRuntime.checkAvailability()) {
    console.log('⚠️  Bacalhau is not available.\n');
    console.log('   To install Bacalhau:');
    console.log('   curl -sL https://get.bacalhau.org/install.sh | bash\n');
    console.log('   To start local devstack:');
    console.log('   bacalhau devstack\n');
    console.log('   Then set BACALHAU_ENABLED=true in your .env file\n');
    process.exit(1);
  }

  console.log('✅ Bacalhau is available\n');

  const testCases = [
    {
      name: 'Python basic execution',
      language: 'python' as const,
      code: `
import json
import sys

# Read input
with open('/tmp/input.json', 'r') as f:
    input_data = json.load(f)

# Process
result = {
    'message': 'Hello from Bacalhau!',
    'input': input_data,
    'computation': input_data.get('value', 0) * 2
}

# Output
print(json.dumps(result))
      `,
      input: { value: 10 },
      expectedOutput: { message: 'Hello from Bacalhau!', computation: 20 },
    },
    {
      name: 'Bash basic execution',
      language: 'bash' as const,
      code: `
#!/bin/bash
cat /tmp/input.json
echo "Processed by Bacalhau"
      `,
      input: { test: 'data' },
    },
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name} (${testCase.language})`);
    
    try {
      const result = await bacalhauRuntime.execute(
        testCase.code,
        testCase.language,
        testCase.input,
        300000 // 5 minute timeout
      );
      
      if (result.success) {
        console.log(`  ✅ PASSED - Execution successful`);
        console.log(`     Output: ${JSON.stringify(result.output)}`);
        console.log(`     Job ID: ${result.metadata?.jobId || 'N/A'}`);
        console.log(`     Duration: ${result.metadata?.executionTime || 'N/A'}ms\n`);
        passed++;
      } else {
        // Check if error is due to cluster not running
        if (result.error?.code === 'BACALHAU_NOT_AVAILABLE') {
          console.log(`  ⚠️  SKIPPED - Bacalhau cluster not available`);
          console.log(`     Error: ${result.error.message}\n`);
          skipped++;
        } else {
          console.log(`  ❌ FAILED - Execution error`);
          console.log(`    Error: ${result.error?.message}`);
          console.log(`    Code: ${result.error?.code}\n`);
          failed++;
        }
      }
    } catch (error: any) {
      console.log('  ❌ FAILED - Exception');
      console.log(`    Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ⚠️  Skipped: ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  if (passed + failed > 0) {
    console.log(`  📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);
  }

  if (failed === 0 && passed > 0) {
    console.log('🎉 All Bacalhau execution tests passed!\n');
    process.exit(0);
  } else if (skipped === testCases.length) {
    console.log('⚠️  All tests skipped. Start Bacalhau devstack to run tests.\n');
    console.log('   Run: bacalhau devstack\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
testBacalhauExecution().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

