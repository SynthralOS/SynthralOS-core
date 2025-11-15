import { NodeExecutionResult } from '@sos/shared';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createId } from '@paralleldrive/cuid2';

const execAsync = promisify(exec);

/**
 * Bacalhau Runtime Service
 * 
 * Provides distributed job execution using Bacalhau cluster.
 * Ideal for long-running tasks, GPU workloads, and distributed processing.
 * 
 * Implementation uses Bacalhau CLI for job submission and monitoring.
 * Supports GPU acceleration and distributed execution.
 */

export interface BacalhauConfig {
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
  gpuEnabled?: boolean;
  gpuCount?: number;
  bacalhauPath?: string;
}

export interface BacalhauJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface JobSpec {
  Engine: {
    Type: string;
    Params: Record<string, any>;
  };
  Resources?: {
    GPU?: string;
    Memory?: string;
    CPU?: string;
  };
  Network?: {
    Type: string;
  };
  Outputs?: Array<{
    Name: string;
    Path: string;
  }>;
}

export class BacalhauRuntime {
  private apiUrl: string;
  private apiKey: string;
  private timeout: number;
  private gpuEnabled: boolean;
  private gpuCount: number;
  private bacalhauPath: string;
  private isAvailable: boolean = false;

  constructor(config?: BacalhauConfig) {
    this.apiUrl = config?.apiUrl || process.env.BACALHAU_API_URL || 'http://localhost:1234';
    this.apiKey = config?.apiKey || process.env.BACALHAU_API_KEY || '';
    this.timeout = config?.timeout || 300000; // 5 minutes default for long jobs
    this.gpuEnabled = config?.gpuEnabled || process.env.BACALHAU_GPU_ENABLED === 'true';
    this.gpuCount = config?.gpuCount || parseInt(process.env.BACALHAU_GPU_COUNT || '1');
    this.bacalhauPath = config?.bacalhauPath || process.env.BACALHAU_PATH || 'bacalhau';
    
    // Check if Bacalhau is available (will be checked asynchronously)
    this.isAvailable = process.env.BACALHAU_ENABLED !== 'false';
  }

  /**
   * Initialize and check Bacalhau availability
   */
  async initialize(): Promise<void> {
    if (process.env.BACALHAU_ENABLED === 'false') {
      this.isAvailable = false;
      return;
    }

    try {
      // Check if bacalhau CLI exists
      await execAsync(`which ${this.bacalhauPath} || ${this.bacalhauPath} version`);
      this.isAvailable = true;
    } catch (error) {
      this.isAvailable = false;
      if (process.env.BACALHAU_ENABLED === 'true') {
        console.warn('Bacalhau is enabled but not found. Install with: curl -sL https://get.bacalhau.org/install.sh | bash');
      }
    }
  }

  /**
   * Check if Bacalhau is available
   */
  checkAvailability(): boolean {
    return this.isAvailable;
  }

  /**
   * Create a Docker image specification for code execution
   */
  private createJobSpec(
    code: string,
    language: 'python' | 'javascript' | 'typescript' | 'bash',
    input: any,
    options?: {
      gpu?: boolean;
      gpuCount?: number;
      memory?: string;
      cpu?: string;
    }
  ): JobSpec {
    // Determine base image based on language
    let baseImage: string;
    let command: string[];
    let entrypoint: string[];

    switch (language) {
      case 'python':
        baseImage = 'python:3.11-slim';
        entrypoint = ['/bin/bash', '-c'];
        command = [
          `cat > /tmp/code.py << 'EOF'\n${code}\nEOF\n` +
          `cat > /tmp/input.json << 'EOF'\n${JSON.stringify(input)}\nEOF\n` +
          `python /tmp/code.py`
        ];
        break;
      case 'javascript':
      case 'typescript':
        baseImage = 'node:20-slim';
        entrypoint = ['/bin/bash', '-c'];
        command = [
          `cat > /tmp/code.js << 'EOF'\n${code}\nEOF\n` +
          `cat > /tmp/input.json << 'EOF'\n${JSON.stringify(input)}\nEOF\n` +
          `node /tmp/code.js`
        ];
        break;
      case 'bash':
        baseImage = 'ubuntu:latest';
        entrypoint = ['/bin/bash', '-c'];
        command = [
          `cat > /tmp/input.json << 'EOF'\n${JSON.stringify(input)}\nEOF\n` +
          code
        ];
        break;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    const spec: JobSpec = {
      Engine: {
        Type: 'docker',
        Params: {
          Image: baseImage,
          Entrypoint: entrypoint,
          Parameters: command,
        },
      },
      Resources: {
        Memory: options?.memory || '2GB',
        CPU: options?.cpu || '1',
      },
      Network: {
        Type: 'None', // No network access by default for security
      },
      Outputs: [
        {
          Name: 'output',
          Path: '/outputs',
        },
      ],
    };

    // Add GPU support if enabled
    if (options?.gpu || this.gpuEnabled) {
      spec.Resources!.GPU = (options?.gpuCount || this.gpuCount).toString();
    }

    return spec;
  }

  /**
   * Submit a job to Bacalhau cluster
   */
  async submitJob(
    code: string,
    language: 'python' | 'javascript' | 'typescript' | 'bash',
    input: any,
    options?: {
      gpu?: boolean;
      gpuCount?: number;
      memory?: string;
      cpu?: string;
    }
  ): Promise<string> {
    const tracer = trace.getTracer('sos-bacalhau-runtime');
    const span = tracer.startSpan('bacalhau.submit_job', {
      attributes: {
        'bacalhau.language': language,
        'bacalhau.code_length': code.length,
        'bacalhau.gpu_enabled': options?.gpu || false,
        'bacalhau.gpu_count': options?.gpuCount || 0,
      },
    });

    try {
      if (!this.checkAvailability()) {
        throw new Error('Bacalhau is not available. Install Bacalhau or set BACALHAU_ENABLED=true.');
      }

      // Create job specification
      const jobSpec = this.createJobSpec(code, language, input, options);

      // Write job spec to temporary file
      const tempDir = join(process.cwd(), '.bacalhau-temp');
      await mkdir(tempDir, { recursive: true }).catch(() => {});
      const specFile = join(tempDir, `${createId()}.json`);
      await writeFile(specFile, JSON.stringify(jobSpec, null, 2));

      try {
        // Submit job using Bacalhau CLI
        const submitCommand = `${this.bacalhauPath} job run --json ${specFile}`;
        const { stdout } = await execAsync(submitCommand, {
          timeout: 30000, // 30 second timeout for submission
        });

        // Parse job ID from output
        // Bacalhau CLI outputs: "Job submitted: <job-id>"
        const jobIdMatch = stdout.match(/Job submitted: ([a-f0-9-]+)/i) || 
                          stdout.match(/job_id["\s:]+([a-f0-9-]+)/i);
        
        if (!jobIdMatch) {
          // Try parsing JSON output
          try {
            const jsonOutput = JSON.parse(stdout);
            const jobId = jsonOutput.JobID || jsonOutput.job_id || jsonOutput.id;
            if (jobId) {
              span.setAttributes({ 'bacalhau.job_id': jobId });
              span.setStatus({ code: SpanStatusCode.OK });
              return jobId;
            }
          } catch {
            // Not JSON, continue with error
          }
          throw new Error(`Failed to parse job ID from Bacalhau output: ${stdout}`);
        }

        const jobId = jobIdMatch[1];
        span.setAttributes({ 'bacalhau.job_id': jobId });
        span.setStatus({ code: SpanStatusCode.OK });
        return jobId;
      } finally {
        // Cleanup spec file
        await unlink(specFile).catch(() => {});
      }
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
   * Monitor job status
   */
  async getJobStatus(jobId: string): Promise<BacalhauJob> {
    const tracer = trace.getTracer('sos-bacalhau-runtime');
    const span = tracer.startSpan('bacalhau.get_job_status', {
      attributes: {
        'bacalhau.job_id': jobId,
      },
    });

    try {
      if (!this.checkAvailability()) {
        throw new Error('Bacalhau is not available.');
      }

      // Query job status using Bacalhau CLI
      const statusCommand = `${this.bacalhauPath} job describe ${jobId} --json`;
      const { stdout } = await execAsync(statusCommand, {
        timeout: 10000, // 10 second timeout
      });

      // Parse job status from JSON output
      const jobInfo = JSON.parse(stdout);
      const state = jobInfo.State?.State || jobInfo.state || 'unknown';
      
      let status: 'pending' | 'running' | 'completed' | 'failed';
      if (state === 'Queued' || state === 'InProgress') {
        status = 'running';
      } else if (state === 'Completed') {
        status = 'completed';
      } else if (state === 'Error' || state === 'Failed' || state === 'Cancelled') {
        status = 'failed';
      } else {
        status = 'pending';
      }

      const job: BacalhauJob = {
        id: jobId,
        status,
        error: status === 'failed' ? (jobInfo.State?.Error || jobInfo.error || 'Job failed') : undefined,
      };

      span.setAttributes({
        'bacalhau.job_status': status,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return job;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      
      // Return pending status if we can't determine status
      return {
        id: jobId,
        status: 'pending',
        error: error.message,
      };
    } finally {
      span.end();
    }
  }

  /**
   * Get job results
   */
  async getJobResults(jobId: string): Promise<any> {
    const tracer = trace.getTracer('sos-bacalhau-runtime');
    const span = tracer.startSpan('bacalhau.get_job_results', {
      attributes: {
        'bacalhau.job_id': jobId,
      },
    });

    try {
      if (!this.checkAvailability()) {
        throw new Error('Bacalhau is not available.');
      }

      // Create temporary directory for results
      const tempDir = join(process.cwd(), '.bacalhau-temp', jobId);
      await mkdir(tempDir, { recursive: true }).catch(() => {});

      try {
        // Download results using Bacalhau CLI
        const getCommand = `${this.bacalhauPath} get ${jobId} --output-dir ${tempDir}`;
        await execAsync(getCommand, {
          timeout: 60000, // 60 second timeout for download
        });

        // Read output file
        const outputFile = join(tempDir, 'outputs', 'output', 'stdout');
        if (existsSync(outputFile)) {
          const output = await readFile(outputFile, 'utf-8');
          
          // Try to parse as JSON, otherwise return as string
          try {
            const parsed = JSON.parse(output);
            span.setStatus({ code: SpanStatusCode.OK });
            return parsed;
          } catch {
            span.setStatus({ code: SpanStatusCode.OK });
            return output.trim();
          }
        }

        // If no stdout, check for output.json
        const jsonOutputFile = join(tempDir, 'outputs', 'output', 'output.json');
        if (existsSync(jsonOutputFile)) {
          const output = await readFile(jsonOutputFile, 'utf-8');
          const parsed = JSON.parse(output);
          span.setStatus({ code: SpanStatusCode.OK });
          return parsed;
        }

        // Return empty result if no output found
        span.setStatus({ code: SpanStatusCode.OK });
        return null;
      } finally {
        // Cleanup results directory (optional - can keep for debugging)
        // await execAsync(`rm -rf ${tempDir}`).catch(() => {});
      }
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
   * Execute code in Bacalhau cluster
   */
  async execute(
    code: string,
    language: 'python' | 'javascript' | 'typescript' | 'bash',
    input: any,
    timeout: number = 300000,
    options?: {
      gpu?: boolean;
      gpuCount?: number;
      memory?: string;
      cpu?: string;
    }
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const tracer = trace.getTracer('sos-bacalhau-runtime');
    const span = tracer.startSpan('bacalhau.execute', {
      attributes: {
        'bacalhau.language': language,
        'bacalhau.timeout': timeout,
        'bacalhau.code_length': code.length,
        'bacalhau.runtime': 'bacalhau',
        'bacalhau.gpu_enabled': options?.gpu || false,
      },
    });

    try {
      if (!this.checkAvailability()) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Bacalhau not available',
        });
        return {
          success: false,
          error: {
            message: 'Bacalhau runtime is not available. Install Bacalhau or set BACALHAU_ENABLED=true.',
            code: 'BACALHAU_NOT_AVAILABLE',
            details: {
              note: 'To use Bacalhau:',
              steps: [
                '1. Install Bacalhau: curl -sL https://get.bacalhau.org/install.sh | bash',
                '2. Start devstack: bacalhau devstack (for local testing)',
                '3. Set BACALHAU_ENABLED=true',
              ],
            },
          },
        };
      }

      // Submit job
      const jobId = await this.submitJob(code, language, input, options);
      span.setAttributes({ 'bacalhau.job_id': jobId });

      // Monitor job until completion
      const maxWaitTime = Math.min(timeout, this.timeout);
      const pollInterval = 5000; // Poll every 5 seconds
      const startPollTime = Date.now();

      while (Date.now() - startPollTime < maxWaitTime) {
        const jobStatus = await this.getJobStatus(jobId);
        
        if (jobStatus.status === 'completed') {
          // Get results
          const results = await this.getJobResults(jobId);
          const durationMs = Date.now() - startTime;

          span.setAttributes({
            'bacalhau.success': true,
            'bacalhau.duration_ms': durationMs,
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return {
            success: true,
            output: { output: results },
            metadata: {
              jobId,
              executionTime: durationMs,
            },
          };
        } else if (jobStatus.status === 'failed') {
          span.setAttributes({ 'bacalhau.success': false });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: jobStatus.error || 'Job failed',
          });

          return {
            success: false,
            error: {
              message: jobStatus.error || 'Bacalhau job failed',
              code: 'BACALHAU_JOB_FAILED',
              details: { jobId },
            },
          };
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      // Timeout
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Job execution timed out',
      });

      return {
        success: false,
        error: {
          message: `Bacalhau job execution timed out after ${timeout}ms`,
          code: 'BACALHAU_TIMEOUT',
          details: { jobId },
        },
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });

      return {
        success: false,
        error: {
          message: error.message || 'Bacalhau execution failed',
          code: 'BACALHAU_EXECUTION_ERROR',
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
    // Bacalhau jobs are automatically cleaned up
    // This method is here for consistency with other runtimes
  }
}

export const bacalhauRuntime = new BacalhauRuntime();

// Initialize availability check asynchronously
bacalhauRuntime.initialize().catch((error) => {
  console.warn('Failed to check Bacalhau availability:', error);
});
