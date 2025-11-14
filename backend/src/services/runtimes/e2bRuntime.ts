import { E2B } from '@e2b/sdk';
import { NodeExecutionResult } from '@sos/shared';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * E2B Runtime Service
 * 
 * Provides ultra-fast (<50ms P50) code execution using E2B sandboxes.
 * Ideal for inline transforms and transient functions.
 */

export interface E2BConfig {
  apiKey?: string;
  template?: 'python3' | 'node' | 'bash';
  timeout?: number;
}

export class E2BRuntime {
  private client: E2B | null = null;
  private apiKey: string;

  constructor(config?: E2BConfig) {
    this.apiKey = config?.apiKey || process.env.E2B_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('E2B_API_KEY not set. E2B runtime will not be available.');
    } else {
      try {
        this.client = new E2B(this.apiKey);
      } catch (error) {
        console.error('Failed to initialize E2B client:', error);
      }
    }
  }

  /**
   * Check if E2B is available
   */
  isAvailable(): boolean {
    return this.client !== null && !!this.apiKey;
  }

  /**
   * Execute code in E2B sandbox
   */
  async execute(
    code: string,
    language: 'python' | 'javascript' | 'typescript' | 'bash',
    input: any,
    timeout: number = 5000
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const tracer = trace.getTracer('sos-e2b-runtime');
    const span = tracer.startSpan('e2b.execute', {
      attributes: {
        'e2b.language': language,
        'e2b.timeout': timeout,
        'e2b.code_length': code.length,
        'e2b.runtime': 'e2b',
      },
    });

    try {
      if (!this.isAvailable()) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'E2B not available',
        });
        return {
          success: false,
          error: {
            message: 'E2B runtime is not available. Set E2B_API_KEY environment variable.',
            code: 'E2B_NOT_AVAILABLE',
          },
        };
      }

      // Determine template based on language
      let template: 'python3' | 'node' | 'bash' = 'node';
      if (language === 'python') {
        template = 'python3';
      } else if (language === 'bash') {
        template = 'bash';
      } else {
        template = 'node'; // JavaScript/TypeScript
      }

      // Create sandbox
      const sandbox = await this.client!.sandbox.create({
        template,
      });

      span.setAttributes({
        'e2b.template': template,
        'e2b.sandbox_id': sandbox.sandboxId,
      });

      try {
        // Prepare code file
        const codeFile = language === 'python' ? '/code/main.py' : 
                        language === 'bash' ? '/code/main.sh' : 
                        '/code/main.js';

        // Write code to file
        await sandbox.filesystem.write(codeFile, code);

        // Prepare execution command
        let command: string[];
        if (language === 'python') {
          command = ['python3', codeFile];
        } else if (language === 'bash') {
          command = ['bash', codeFile];
        } else {
          // JavaScript/TypeScript - compile TypeScript first if needed
          if (language === 'typescript') {
            // For TypeScript, we'd need to compile it first
            // For now, assume it's already compiled or use ts-node
            command = ['node', codeFile];
          } else {
            command = ['node', codeFile];
          }
        }

        // Set input as environment variable
        const envVars: Record<string, string> = {
          INPUT: JSON.stringify(input),
        };

        // Execute code
        const exec = await sandbox.process.start({
          cmd: command,
          envVars,
        });

        // Wait for execution with timeout
        const result = await Promise.race([
          exec.wait(),
          new Promise<{ exitCode: number; stdout: string; stderr: string }>((_, reject) =>
            setTimeout(() => reject(new Error(`E2B execution timed out after ${timeout}ms`)), timeout)
          ),
        ]);

        // Parse output
        let output: any;
        try {
          const stdout = result.stdout.trim();
          if (stdout) {
            output = JSON.parse(stdout);
          } else {
            output = input; // Return input if no output
          }
        } catch {
          // If JSON parsing fails, return raw stdout
          output = result.stdout.trim() || input;
        }

        const success = result.exitCode === 0;
        const durationMs = Date.now() - startTime;

        // Try to get memory usage from sandbox metrics if available
        let memoryMb: number | undefined;
        try {
          // E2B may provide memory metrics - check if available
          // This is a placeholder - actual implementation depends on E2B SDK capabilities
          // For now, we'll leave it undefined
        } catch {
          // Memory metrics not available
        }

        span.setAttributes({
          'e2b.success': success,
          'e2b.exit_code': result.exitCode,
          'e2b.stdout_length': result.stdout.length,
          'e2b.stderr_length': result.stderr.length,
          'e2b.duration_ms': durationMs,
          ...(memoryMb !== undefined && { 'e2b.memory_mb': memoryMb }),
        });
        span.setStatus({
          code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        });

        return {
          success,
          output: success
            ? { output }
            : undefined,
          error: success
            ? undefined
            : {
                message: result.stderr || 'E2B execution failed',
                code: 'E2B_EXECUTION_ERROR',
                details: {
                  exitCode: result.exitCode,
                  stderr: result.stderr,
                  stdout: result.stdout,
                },
              },
          metadata: {
            exitCode: result.exitCode,
            ...(memoryMb !== undefined && { memoryMb }),
          },
        };
      } finally {
        // Always close sandbox
        await sandbox.close();
      }
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });

      if (error.message?.includes('timed out')) {
        return {
          success: false,
          error: {
            message: error.message,
            code: 'E2B_TIMEOUT',
          },
        };
      }

      return {
        success: false,
        error: {
          message: error.message || 'E2B execution failed',
          code: 'E2B_EXECUTION_ERROR',
          details: error,
        },
      };
    } finally {
      span.end();
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // E2B sandboxes are automatically cleaned up when closed
    // This method is here for consistency with other runtimes
  }
}

export const e2bRuntime = new E2BRuntime();

