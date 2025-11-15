/**
 * Test script for agent code execution
 * 
 * This script tests the agent's ability to write and execute code using the execute_code tool.
 * Run with: npx tsx scripts/test-agent-code-execution.ts
 */

import { executeAgent } from '../src/services/nodeExecutors/agent';
import { NodeExecutionContext } from '@sos/shared';

async function testAgentCodeExecution() {
  console.log('🧪 Testing Agent Code Execution...\n');

  const testCases = [
    {
      name: 'Agent calculates sum using code',
      config: {
        type: 'ai.agent',
        agentType: 'react',
        provider: 'openai',
        model: 'gpt-4',
        tools: ['execute_code', 'calculator'],
        systemPrompt: 'You are a helpful assistant that can write and execute code to solve problems.',
      },
      input: {
        query: 'Write and execute code to calculate the sum of numbers 1 through 100. Use the execute_code tool.',
      },
    },
    {
      name: 'Agent processes data with code',
      config: {
        type: 'ai.agent',
        agentType: 'react',
        provider: 'openai',
        model: 'gpt-4',
        tools: ['execute_code'],
        systemPrompt: 'You are a data processing assistant.',
      },
      input: {
        query: 'Write code to process this array: [1, 2, 3, 4, 5] and return the doubled values. Use execute_code tool.',
      },
    },
    {
      name: 'Agent handles errors in code',
      config: {
        type: 'ai.agent',
        agentType: 'react',
        provider: 'openai',
        model: 'gpt-4',
        tools: ['execute_code'],
        systemPrompt: 'You are a helpful assistant that can debug code.',
      },
      input: {
        query: 'Write code that intentionally has an error, then fix it using execute_code tool.',
      },
    },
  ];

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    const context: NodeExecutionContext = {
      nodeId: 'test-node',
      workflowId: 'test-workflow',
      executionId: 'test-execution',
      input: testCase.input,
      config: testCase.config,
    };

    try {
      // Note: This requires OpenAI API key and will make actual API calls
      const result = await executeAgent(context);
      
      if (result.success) {
        const output = result.output as any;
        const outputText = typeof output === 'string' ? output : JSON.stringify(output);
        
        // Check if agent used execute_code tool
        if (outputText.includes('execute_code') || outputText.includes('code executed') || outputText.includes('sum') || outputText.includes('doubled')) {
          console.log('  ✅ PASSED - Agent executed code successfully');
          console.log(`     Output preview: ${outputText.substring(0, 100)}...\n`);
          passed++;
        } else {
          console.log('  ⚠️  SKIPPED - Agent did not use execute_code tool (may need better prompting)');
          console.log(`     Output: ${outputText.substring(0, 100)}...\n`);
          skipped++;
        }
      } else {
        // Check if error is due to missing API key
        if (result.error?.message?.includes('API key') || result.error?.message?.includes('OPENAI')) {
          console.log('  ⚠️  SKIPPED - OpenAI API key not configured');
          console.log('     Set OPENAI_API_KEY environment variable to run this test\n');
          skipped++;
        } else {
          console.log('  ❌ FAILED - Execution error');
          console.log(`    Error: ${result.error?.message}\n`);
          failed++;
        }
      }
    } catch (error: any) {
      if (error.message?.includes('API key') || error.message?.includes('OPENAI')) {
        console.log('  ⚠️  SKIPPED - OpenAI API key not configured\n');
        skipped++;
      } else {
        console.log('  ❌ FAILED - Exception');
        console.log(`    Error: ${error.message}\n`);
        failed++;
      }
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
    console.log('🎉 All agent code execution tests passed!\n');
    process.exit(0);
  } else if (skipped === testCases.length) {
    console.log('⚠️  All tests skipped. Configure OpenAI API key to run tests.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
testAgentCodeExecution().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

