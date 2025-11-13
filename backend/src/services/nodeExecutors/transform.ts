import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';

export async function executeTransform(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;
  const operation = nodeConfig.operation || 'map';
  const data = input.input || input;

  try {
    let result: unknown;

    switch (operation) {
      case 'map':
        // Simple map operation - just return the data for now
        result = Array.isArray(data) ? data : [data];
        break;

      case 'filter':
        // Filter operation
        if (Array.isArray(data)) {
          result = data.filter((item) => Boolean(item));
        } else {
          result = data;
        }
        break;

      case 'sort':
        // Sort operation
        if (Array.isArray(data)) {
          result = [...data].sort();
        } else {
          result = data;
        }
        break;

      case 'merge':
        // Merge with previous outputs
        result = {
          ...context.previousOutputs,
          ...(typeof data === 'object' && data !== null ? data : {}),
        };
        break;

      default:
        result = data;
    }

    return {
      success: true,
      output: {
        output: result,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Transform failed',
        code: 'TRANSFORM_ERROR',
        details: error,
      },
    };
  }
}

