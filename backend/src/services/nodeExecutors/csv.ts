import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';

export async function executeCSV(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const operation = (nodeConfig.operation as string) || 'parse';
  const data = (input.data as string) || '';
  const delimiter = (nodeConfig.delimiter as string) || ',';
  const hasHeaders = (nodeConfig.hasHeaders as boolean) !== false;

  try {
    switch (operation) {
      case 'parse': {
        if (!data) {
          return {
            success: false,
            error: {
              message: 'CSV data is required for parse operation',
              code: 'MISSING_DATA',
            },
          };
        }

        const lines = data.split('\n').filter((line) => line.trim());
        if (lines.length === 0) {
          return {
            success: true,
            output: {
              rows: [],
              headers: [],
            },
          };
        }

        const headers = hasHeaders ? lines[0].split(delimiter).map((h) => h.trim()) : [];
        const startIndex = hasHeaders ? 1 : 0;
        const rows = lines.slice(startIndex).map((line) => {
          const values = line.split(delimiter).map((v) => v.trim());
          if (hasHeaders && headers.length > 0) {
            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            return row;
          }
          return values;
        });

        return {
          success: true,
          output: {
            rows,
            headers,
          },
        };
      }

      case 'stringify': {
        const rows = (input.rows as any[]) || (input.data as any[]) || [];
        if (rows.length === 0) {
          return {
            success: true,
            output: {
              csv: '',
            },
          };
        }

        const headers = (input.headers as string[]) || Object.keys(rows[0] || {});
        let csv = '';

        if (hasHeaders && headers.length > 0) {
          csv += headers.join(delimiter) + '\n';
        }

        rows.forEach((row) => {
          if (Array.isArray(row)) {
            csv += row.join(delimiter) + '\n';
          } else if (typeof row === 'object') {
            const values = headers.map((header) => String(row[header] || ''));
            csv += values.join(delimiter) + '\n';
          }
        });

        return {
          success: true,
          output: {
            csv: csv.trim(),
          },
        };
      }

      case 'convert': {
        // Convert array of objects to CSV
        const data = (input.data as any[]) || [];
        if (data.length === 0) {
          return {
            success: true,
            output: {
              csv: '',
              rows: [],
              headers: [],
            },
          };
        }

        const headers = Object.keys(data[0] || {});
        const csv = [headers.join(delimiter), ...data.map((row) => headers.map((h) => String(row[h] || '')).join(delimiter))].join('\n');

        return {
          success: true,
          output: {
            csv,
            rows: data,
            headers,
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
        message: error.message || 'CSV operation failed',
        code: 'CSV_OPERATION_ERROR',
        details: error,
      },
    };
  }
}

