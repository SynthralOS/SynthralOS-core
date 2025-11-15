/**
 * Test script for TypeScript code execution
 * 
 * This script tests the TypeScript execution functionality in the code executor.
 * Run with: npx tsx scripts/test-typescript-execution.ts
 */

import { executeCode } from '../src/services/nodeExecutors/code';
import { NodeExecutionContext } from '@sos/shared';

async function testTypeScriptExecution() {
  console.log('🧪 Testing TypeScript Execution...\n');

  const testCases = [
    {
      name: 'Basic TypeScript with types',
      code: `
        interface User {
          name: string;
          age: number;
        }
        
        const user: User = {
          name: input.name || 'John',
          age: input.age || 30
        };
        
        return { output: user };
      `,
      input: { name: 'Alice', age: 25 },
      expected: { name: 'Alice', age: 25 },
    },
    {
      name: 'TypeScript with generics',
      code: `
        function process<T>(data: T): T {
          return data;
        }
        
        const result = process(input);
        return { output: result };
      `,
      input: { items: [1, 2, 3] },
      expected: { items: [1, 2, 3] },
    },
    {
      name: 'TypeScript with async/await',
      code: `
        async function fetchData() {
          return Promise.resolve(input);
        }
        
        const result = await fetchData();
        return { output: result };
      `,
      input: { data: 'test' },
      expected: { data: 'test' },
    },
    {
      name: 'TypeScript with array methods',
      code: `
        const numbers: number[] = input.numbers || [];
        const doubled = numbers.map(n => n * 2);
        return { output: { doubled } };
      `,
      input: { numbers: [1, 2, 3, 4, 5] },
      expected: { doubled: [2, 4, 6, 8, 10] },
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
        type: 'action.code.typescript',
        code: testCase.code,
        runtime: 'vm2',
      },
    };

    try {
      const result = await executeCode(context, 'typescript');
      
      if (result.success) {
        const output = (result.output as any)?.output;
        const matches = JSON.stringify(output) === JSON.stringify(testCase.expected);
        
        if (matches) {
          console.log('  ✅ PASSED\n');
          passed++;
        } else {
          console.log('  ❌ FAILED - Output mismatch');
          console.log(`    Expected: ${JSON.stringify(testCase.expected)}`);
          console.log(`    Got: ${JSON.stringify(output)}\n`);
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
    console.log('🎉 All TypeScript execution tests passed!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
testTypeScriptExecution().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

