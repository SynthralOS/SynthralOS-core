import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { VM } from 'vm2';

/**
 * Execute IF/ELSE logic node
 * Evaluates a condition and routes to true/false output
 */
export async function executeIf(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  try {
    const { input, config, previousOutputs } = context;
    const condition = (config as any).condition || 'input';

    // Evaluate condition using VM2 for safety
    const vm = new VM({
      timeout: 1000,
      sandbox: {
        input,
        ...previousOutputs,
      },
    });

    let result: boolean;
    try {
      result = vm.run(`Boolean(${condition})`);
    } catch (error: any) {
      // If condition is not valid JS, try as a simple truthy check
      result = Boolean(input);
    }

    return {
      success: true,
      output: {
        condition: result,
        data: input,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: `IF condition evaluation failed: ${error.message}`,
        code: 'IF_CONDITION_ERROR',
        details: error,
      },
    };
  }
}

/**
 * Execute Switch node
 * Routes to different outputs based on input value
 */
export async function executeSwitch(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  try {
    const { input, config } = context;
    const cases = (config as any).cases || [];
    const defaultCase = (config as any).defaultCase || 'default';

    // Find matching case
    let matchedCase = cases.find((c: any) => {
      if (c.value === input) return true;
      if (typeof c.value === 'string' && typeof input === 'string') {
        return c.value.toLowerCase() === input.toLowerCase();
      }
      return false;
    });

    const outputName = matchedCase?.output || defaultCase;

    return {
      success: true,
      output: {
        case: outputName,
        data: input,
        matched: !!matchedCase,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: `Switch evaluation failed: ${error.message}`,
        code: 'SWITCH_ERROR',
        details: error,
      },
    };
  }
}

/**
 * Execute Error Catch node
 * Catches errors from previous nodes and allows error handling logic
 */
export async function executeErrorCatch(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  try {
    const { input, config } = context;
    const error = (input as any)?.error;
    const originalInput = (input as any)?.originalInput;
    const failedNodeId = (input as any)?.failedNodeId;

    // Error catch node receives error information
    // It can transform, log, or handle the error
    const action = (config as any)?.action || 'pass'; // 'pass', 'transform', 'suppress'

    if (action === 'suppress') {
      // Suppress error and continue with empty output
      return {
        success: true,
        output: {},
      };
    } else if (action === 'transform') {
      // Transform error into a success output
      const transformConfig = (config as any)?.transform || {};
      return {
        success: true,
        output: {
          handled: true,
          error: error,
          transformed: transformConfig.output || { message: 'Error handled' },
        },
      };
    } else {
      // Pass through error information (default)
      return {
        success: true,
        output: {
          error: error,
          originalInput: originalInput,
          failedNodeId: failedNodeId,
          handled: true,
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: `Error catch node failed: ${error.message}`,
        code: 'ERROR_CATCH_ERROR',
        details: error,
      },
    };
  }
}

/**
 * Execute Wait/Delay node
 * Waits for a specified duration
 */
export async function executeWait(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  try {
    const { input, config } = context;
    const duration = (config as any).duration || 1000;

    if (duration < 0 || duration > 60000) {
      return {
        success: false,
        error: {
          message: 'Wait duration must be between 0 and 60000 milliseconds',
          code: 'INVALID_DURATION',
        },
      };
    }

    await new Promise((resolve) => setTimeout(resolve, duration));

    return {
      success: true,
      output: {
        data: input,
        waited: duration,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: `Wait failed: ${error.message}`,
        code: 'WAIT_ERROR',
        details: error,
      },
    };
  }
}

/**
 * Execute Merge node
 * Merges multiple inputs into one output
 */
export async function executeMerge(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  try {
    const { input, config, previousOutputs } = context;
    const mergeStrategy = (config as any).mergeStrategy || 'all';

    // Collect all inputs from previous outputs
    const inputs: unknown[] = [];
    
    // Get all inputs (input1, input2, etc. or from previous outputs)
    if (typeof input === 'object' && input !== null) {
      Object.values(input).forEach((value) => {
        if (value !== undefined) {
          inputs.push(value);
        }
      });
    } else {
      inputs.push(input);
    }

    // Also check previous outputs for merge inputs
    Object.values(previousOutputs).forEach((output: any) => {
      if (output && typeof output === 'object' && output.data !== undefined) {
        inputs.push(output.data);
      }
    });

    let merged: unknown;

    switch (mergeStrategy) {
      case 'all':
        // Merge all inputs into an object
        merged = inputs.reduce((acc: any, val: any, index: number) => {
          acc[`input${index + 1}`] = val;
          return acc;
        }, {});
        break;
      case 'first':
        merged = inputs[0];
        break;
      case 'last':
        merged = inputs[inputs.length - 1];
        break;
      case 'array':
        merged = inputs;
        break;
      default:
        merged = inputs;
    }

    return {
      success: true,
      output: {
        merged,
        count: inputs.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: `Merge failed: ${error.message}`,
        code: 'MERGE_ERROR',
        details: error,
      },
    };
  }
}

