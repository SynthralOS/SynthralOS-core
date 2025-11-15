/**
 * Test script for Bash code execution
 * 
 * This script tests the Bash execution functionality in the code executor.
 * Run with: npx tsx scripts/test-bash-execution.ts
 */

import { executeCode } from '../src/services/nodeExecutors/code';
import { NodeExecutionContext } from '@sos/shared';

async function testBashExecution() {
  console.log('🧪 Testing Bash Execution...\n');

  const testCases = [
    {
      name: 'Basic Bash command',
      code: `
        echo "Hello, World!"
        echo '{"output": "Hello, World!"}'
      `,
      input: {},
      expectedOutput: 'Hello, World!',
    },
    {
      name: 'Bash with input processing',
      code: `
        # Read input from environment
        INPUT='${JSON.stringify({ name: 'Alice', age: 25 })}'
        DATA=$(echo $INPUT | jq -r '.')
        
        # Process data
        NAME=$(echo $DATA | jq -r '.name')
        AGE=$(echo $DATA | jq -r '.age')
        
        # Output JSON
        echo "{\"output\": {\"greeting\": \"Hello, $NAME\", \"age\": $AGE}}"
      `,
      input: { name: 'Alice', age: 25 },
      expectedOutput: { greeting: 'Hello, Alice', age: 25 },
    },
    {
      name: 'Bash with arithmetic',
      code: `
        A=10
        B=20
        SUM=$((A + B))
        echo "{\"output\": {\"sum\": $SUM}}"
      `,
      input: {},
      expectedOutput: { sum: 30 },
    },
    {
      name: 'Bash with array processing',
      code: `
        ARRAY=(1 2 3 4 5)
        SUM=0
        for i in "${ARRAY[@]}"; do
          SUM=$((SUM + i))
        done
        echo "{\"output\": {\"sum\": $SUM, \"count\": ${#ARRAY[@]}}}"
      `,
      input: {},
      expectedOutput: { sum: 15, count: 5 },
    },
    {
      name: 'Bash with conditional logic',
      code: `
        VALUE=42
        if [ $VALUE -gt 40 ]; then
          RESULT="high"
        else
          RESULT="low"
        fi
        echo "{\"output\": {\"value\": $VALUE, \"result\": \"$RESULT\"}}"
      `,
      input: {},
      expectedOutput: { value: 42, result: 'high' },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    const context: NodeExecutionContext = {
      nodeId: 'test-node',
      workflowId: 'test-workflow',
      executionId: 'test-execution',
      input: testCase.input,
      config: {
        type: 'action.code.bash',
        code: testCase.code,
        runtime: 'subprocess',
        timeout: 10000,
      },
    };

    try {
      const result = await executeCode(context, 'bash');
      
      if (result.success) {
        const output = (result.output as any)?.output;
        
        // For string outputs, check if it contains expected text
        if (typeof testCase.expectedOutput === 'string') {
          const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
          if (outputStr.includes(testCase.expectedOutput)) {
            console.log('  ✅ PASSED\n');
            passed++;
          } else {
            console.log('  ❌ FAILED - Output mismatch');
            console.log(`    Expected to contain: ${testCase.expectedOutput}`);
            console.log(`    Got: ${outputStr}\n`);
            failed++;
          }
        } else {
          // For object outputs, compare JSON
          const matches = JSON.stringify(output) === JSON.stringify(testCase.expectedOutput);
          
          if (matches) {
            console.log('  ✅ PASSED\n');
            passed++;
          } else {
            console.log('  ❌ FAILED - Output mismatch');
            console.log(`    Expected: ${JSON.stringify(testCase.expectedOutput)}`);
            console.log(`    Got: ${JSON.stringify(output)}\n`);
            failed++;
          }
        }
      } else {
        console.log('  ❌ FAILED - Execution error');
        console.log(`    Error: ${result.error?.message}`);
        if (result.error?.details) {
          console.log(`    Details: ${JSON.stringify(result.error.details, null, 2)}`);
        }
        console.log('');
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
    console.log('🎉 All Bash execution tests passed!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
testBashExecution().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

