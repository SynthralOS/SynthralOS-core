import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { VM } from 'vm2';

export async function executeJSONTransform(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const operation = (nodeConfig.operation as string) || 'transform';
  const data = input.data || input;
  const transformCode = (nodeConfig.transformCode as string) || 'return input;';
  const jsonPath = (nodeConfig.path as string) || '$';

  try {
    switch (operation) {
      case 'transform': {
        const vm = new VM({
          timeout: 5000,
          sandbox: {
            input: data,
          },
        });
        const result = vm.run(`(${transformCode})`);
        return {
          success: true,
          output: {
            output: result,
          },
        };
      }

      case 'merge': {
        const data1 = (input.data1 as any) || {};
        const data2 = (input.data2 as any) || data;
        const merged = { ...data1, ...data2 };
        return {
          success: true,
          output: {
            output: merged,
          },
        };
      }

      case 'filter': {
        const array = Array.isArray(data) ? data : [data];
        const filterCode = transformCode || 'true';
        const vm = new VM({
          timeout: 5000,
          sandbox: {
            item: null,
          },
        });
        const filtered = array.filter((item) => {
          try {
            vm.sandbox.item = item;
            return vm.run(`Boolean(${filterCode})`);
          } catch {
            return false;
          }
        });
        return {
          success: true,
          output: {
            output: filtered,
          },
        };
      }

      case 'map': {
        const array = Array.isArray(data) ? data : [data];
        const mapCode = transformCode || 'item';
        const vm = new VM({
          timeout: 5000,
          sandbox: {
            item: null,
          },
        });
        const mapped = array.map((item) => {
          try {
            vm.sandbox.item = item;
            return vm.run(`(${mapCode})`);
          } catch {
            return item;
          }
        });
        return {
          success: true,
          output: {
            output: mapped,
          },
        };
      }

      case 'flatten': {
        function flatten(obj: any, prefix = ''): Record<string, any> {
          const flattened: Record<string, any> = {};
          for (const key in obj) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
              Object.assign(flattened, flatten(obj[key], newKey));
            } else {
              flattened[newKey] = obj[key];
            }
          }
          return flattened;
        }
        return {
          success: true,
          output: {
            output: flatten(data),
          },
        };
      }

      case 'unflatten': {
        function unflatten(obj: Record<string, any>): any {
          const result: any = {};
          for (const key in obj) {
            const keys = key.split('.');
            let current = result;
            for (let i = 0; i < keys.length - 1; i++) {
              if (!(keys[i] in current)) {
                current[keys[i]] = {};
              }
              current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = obj[key];
          }
          return result;
        }
        return {
          success: true,
          output: {
            output: unflatten(data as Record<string, any>),
          },
        };
      }

      default:
        return {
          success: false,
          error: {
            message: `Unsupported operation: ${operation}`,
            code: 'UNSUPPORTED_OPERATION',
          },
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'JSON transform failed',
        code: 'JSON_TRANSFORM_ERROR',
        details: error,
      },
    };
  }
}

