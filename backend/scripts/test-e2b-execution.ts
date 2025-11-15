/**
 * Test script for E2B code execution
 * 
 * This script tests the E2B execution functionality.
 * Requires E2B_API_KEY environment variable to be set.
 * 
 * Run with: E2B_API_KEY=your_key npx tsx scripts/test-e2b-execution.ts
 */

import { e2bRuntime } from '../src/services/runtimes/e2bRuntime';

async function testE2BExecution() {
  console.log('🧪 Testing E2B Execution...\n');

  // Check if E2B is available
  if (!e2bRuntime.isAvailable()) {
    console.log('⚠️  E2B is not available. Please set E2B_API_KEY environment variable.\n');
    console.log('   Get your API key at: https://e2b.dev\n');
    process.exit(1);
  }

  const testCases = [
    {
      name: 'Python basic execution',
      language: 'python' as const,
      code: `
import json
import os

input_data = json.loads(os.environ.get('INPUT', '{}'))
result = {
    'output': {
        'message': f"Hello, {input_data.get('name', 'World')}!",
        'processed': True
    }
}
print(json.dumps(result))
      `,
      input: { name: 'Alice' },
    },
    {
      name: 'JavaScript basic execution',
      language: 'javascript' as const,
      code: `
const input = JSON.parse(process.env.INPUT || '{}');
const result = {
  output: {
    message: \`Hello, \${input.name || 'World'}!\`,
    processed: true
  }
};
console.log(JSON.stringify(result));
      `,
      input: { name: 'Bob' },
    },
    {
      name: 'Bash basic execution',
      language: 'bash' as const,
      code: `
#!/bin/bash
INPUT='${JSON.stringify({ name: 'Charlie' })}'
NAME=$(echo $INPUT | jq -r '.name // "World"')
echo "{\"output\": {\"message\": \"Hello, $NAME!\", \"processed\": true}}"
      `,
      input: { name: 'Charlie' },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name} (${testCase.language})`);
    
    try {
      const result = await e2bRuntime.execute(
        testCase.code,
        testCase.language,
        testCase.input,
        10000 // 10 second timeout
      );
      
      if (result.success) {
        const output = (result.output as any)?.output;
        if (output && output.message && output.processed) {
          console.log(`  ✅ PASSED - ${output.message}`);
          console.log(`     Duration: ${result.metadata?.executionTime || 'N/A'}ms\n`);
          passed++;
        } else {
          console.log('  ❌ FAILED - Invalid output format');
          console.log(`    Output: ${JSON.stringify(output)}\n`);
          failed++;
        }
      } else {
        console.log('  ❌ FAILED - Execution error');
        console.log(`    Error: ${result.error?.message}\n`);
        failed++;
      }
    } catch (error: any) {
      console.log('  ❌ FAILED - Exception');
      console.log(`    Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

  if (failed === 0) {
    console.log('🎉 All E2B execution tests passed!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
testE2BExecution().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

