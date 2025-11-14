import { NodeExecutionResult } from '@sos/shared';
import { e2bRuntime } from './runtimes/e2bRuntime';
import { executeCode } from './nodeExecutors/code';
import { NodeExecutionContext } from '@sos/shared';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Runtime Router Service
 * 
 * Intelligently routes code execution to the best runtime based on:
 * - Execution time requirements (<50ms → E2B)
 * - Security requirements (sandbox → WasmEdge)
 * - Job length (long → Bacalhau)
 * - Default (VM2/subprocess)
 */

export interface CodeExecutionConfig {
  runtime?: 'vm2' | 'e2b' | 'wasmedge' | 'bacalhau' | 'subprocess' | 'auto';
  requiresSandbox?: boolean;
  longJob?: boolean;
  expectedDuration?: number; // milliseconds
  language: 'javascript' | 'python' | 'typescript' | 'bash';
  code: string;
  input: any;
  packages?: string[];
  timeout?: number;
}

export class RuntimeRouter {
  /**
   * Route code execution to appropriate runtime
   */
  async route(
    config: CodeExecutionConfig
  ): Promise<NodeExecutionResult> {
    const tracer = trace.getTracer('sos-runtime-router');
    const span = tracer.startSpan('runtimeRouter.route', {
      attributes: {
        'runtime.language': config.language,
        'runtime.requested': config.runtime || 'auto',
        'runtime.requires_sandbox': config.requiresSandbox || false,
        'runtime.long_job': config.longJob || false,
        'runtime.expected_duration': config.expectedDuration || 0,
      },
    });

    try {
      // If runtime is explicitly specified, use it
      if (config.runtime && config.runtime !== 'auto') {
        span.setAttributes({
          'runtime.selected': config.runtime,
          'runtime.reason': 'explicitly_specified',
        });
        return await this.executeWithRuntime(config.runtime, config);
      }

      // Auto-route based on conditions
      const selectedRuntime = this.selectRuntime(config);
      
      span.setAttributes({
        'runtime.selected': selectedRuntime,
        'runtime.reason': 'auto_routed',
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return await this.executeWithRuntime(selectedRuntime, config);
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Select best runtime based on config
   */
  private selectRuntime(config: CodeExecutionConfig): 'vm2' | 'e2b' | 'wasmedge' | 'bacalhau' | 'subprocess' {
    // Long-running jobs → Bacalhau
    if (config.longJob) {
      return 'bacalhau';
    }

    // Requires sandbox → WasmEdge (or E2B if available and fast enough)
    if (config.requiresSandbox) {
      // If expected duration is <50ms and E2B is available, use E2B
      if (config.expectedDuration && config.expectedDuration < 50 && e2bRuntime.isAvailable()) {
        return 'e2b';
      }
      // Otherwise use WasmEdge (when implemented)
      // For now, fall back to VM2 for JS or subprocess for Python/Bash
      return config.language === 'javascript' || config.language === 'typescript' ? 'vm2' : 'subprocess';
    }

    // Expected duration <50ms → E2B
    if (config.expectedDuration && config.expectedDuration < 50 && e2bRuntime.isAvailable()) {
      return 'e2b';
    }

    // Default routing based on language
    if (config.language === 'javascript' || config.language === 'typescript') {
      return 'vm2';
    } else if (config.language === 'python' || config.language === 'bash') {
      return 'subprocess';
    }

    // Fallback
    return 'vm2';
  }

  /**
   * Execute code with specific runtime
   */
  private async executeWithRuntime(
    runtime: 'vm2' | 'e2b' | 'wasmedge' | 'bacalhau' | 'subprocess',
    config: CodeExecutionConfig
  ): Promise<NodeExecutionResult> {
    switch (runtime) {
      case 'e2b':
        if (!e2bRuntime.isAvailable()) {
          // Fallback to default if E2B not available
          return await this.executeWithRuntime(
            config.language === 'javascript' || config.language === 'typescript' ? 'vm2' : 'subprocess',
            config
          );
        }
        return await e2bRuntime.execute(
          config.code,
          config.language,
          config.input,
          config.timeout || 5000
        );

      case 'wasmedge':
        // TODO: Implement WasmEdge runtime
        // For now, fallback to default
        return await this.executeWithRuntime(
          config.language === 'javascript' || config.language === 'typescript' ? 'vm2' : 'subprocess',
          config
        );

      case 'bacalhau':
        // TODO: Implement Bacalhau runtime
        // For now, fallback to default
        return await this.executeWithRuntime(
          config.language === 'javascript' || config.language === 'typescript' ? 'vm2' : 'subprocess',
          config
        );

      case 'vm2':
      case 'subprocess':
      default:
        // Use existing code executor (VM2 for JS/TS, subprocess for Python/Bash)
        const context: NodeExecutionContext = {
          input: config.input,
          config: {
            code: config.code,
            packages: config.packages || [],
            timeout: config.timeout || 30000,
            runtime,
          },
          workflowId: 'runtime-router',
          nodeId: 'code-execution',
        };
        return await executeCode(context, config.language);
    }
  }
}

export const runtimeRouter = new RuntimeRouter();

