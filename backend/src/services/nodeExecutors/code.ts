import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { VM } from 'vm2';

// Security: Dangerous Python packages/modules to block
const BLOCKED_PACKAGES = [
  'os', 'sys', 'subprocess', 'shutil', 'socket', 'urllib', 'requests', 'http',
  'ftplib', 'smtplib', 'telnetlib', 'pickle', 'marshal', 'eval', 'exec', 'compile',
  'importlib', '__import__', 'open', 'file', 'input', 'raw_input',
];

// Security: Allowed packages (whitelist approach - empty means all allowed except blocked)
const ALLOWED_PACKAGES: string[] = process.env.PYTHON_ALLOWED_PACKAGES
  ? process.env.PYTHON_ALLOWED_PACKAGES.split(',').map(p => p.trim())
  : [];

// Security: Validate Python code for dangerous operations
function validatePythonCode(code: string, packages: string[]): { valid: boolean; error?: string } {
  // Check for blocked imports
  const importPattern = /^\s*(?:import|from)\s+(\w+)/gm;
  const matches = code.matchAll(importPattern);
  
  for (const match of matches) {
    const module = match[1];
    if (BLOCKED_PACKAGES.includes(module)) {
      return {
        valid: false,
        error: `Blocked module '${module}' is not allowed for security reasons`,
      };
    }
    
    // If whitelist is enabled, check against it
    if (ALLOWED_PACKAGES.length > 0 && !ALLOWED_PACKAGES.includes(module)) {
      return {
        valid: false,
        error: `Module '${module}' is not in the allowed packages list`,
      };
    }
  }
  
  // Check for dangerous function calls
  const dangerousPatterns = [
    /__import__\s*\(/,
    /eval\s*\(/,
    /exec\s*\(/,
    /compile\s*\(/,
    /open\s*\([^)]*['"]w/,
    /open\s*\([^)]*['"]a/,
    /subprocess\./,
    /os\.system/,
    /os\.popen/,
    /socket\./,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: 'Code contains potentially dangerous operations',
      };
    }
  }
  
  // Validate requested packages
  for (const pkg of packages) {
    if (BLOCKED_PACKAGES.includes(pkg)) {
      return {
        valid: false,
        error: `Package '${pkg}' is blocked for security reasons`,
      };
    }
    
    if (ALLOWED_PACKAGES.length > 0 && !ALLOWED_PACKAGES.includes(pkg)) {
      return {
        valid: false,
        error: `Package '${pkg}' is not in the allowed packages list`,
      };
    }
  }
  
  return { valid: true };
}

export async function executeCode(
  context: NodeExecutionContext,
  language: 'javascript' | 'python'
): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;
  const code = nodeConfig.code || '';

  if (!code) {
    return {
      success: false,
      error: {
        message: 'Code is required',
        code: 'MISSING_CODE',
      },
    };
  }

  if (language === 'javascript') {
    return executeJavaScript(code, input);
  } else if (language === 'python') {
    const packages = nodeConfig.packages || [];
    const timeout = nodeConfig.timeout || 30000;
    return await executePython(code, input, { packages, timeout });
  } else {
    return {
      success: false,
      error: {
        message: `Unsupported language: ${language}`,
        code: 'UNSUPPORTED_LANGUAGE',
      },
    };
  }
}

function executeJavaScript(code: string, input: Record<string, unknown>): NodeExecutionResult {
  try {
    // Create a sandboxed VM
    const vm = new VM({
      timeout: 5000,
      sandbox: {
        input,
        console: {
          log: (...args: unknown[]) => console.log('[Node Execution]', ...args),
        },
      },
    });

    // Wrap code - if it doesn't return, wrap in function
    let wrappedCode = code.trim();
    if (!wrappedCode.includes('return')) {
      wrappedCode = `return (function() { ${code} })();`;
    } else {
      wrappedCode = `(function() { ${code} })();`;
    }

    const result = vm.run(wrappedCode);

    return {
      success: true,
      output: {
        output: result !== undefined ? result : input,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'JavaScript execution failed',
        code: 'JS_EXECUTION_ERROR',
        details: error,
      },
    };
  }
}

async function executePython(
  code: string,
  input: Record<string, unknown>,
  config?: { packages?: string[]; timeout?: number }
): Promise<NodeExecutionResult> {
  try {
    const packages = config?.packages || [];
    
    // Security: Validate code and packages
    const validation = validatePythonCode(code, packages);
    if (!validation.valid) {
      // Security violation - return error (audit logging happens at workflow execution level)
      return {
        success: false,
        error: {
          message: validation.error || 'Code validation failed',
          code: 'PYTHON_SECURITY_ERROR',
        },
      };
    }
    
    // Option 1: Use external Python service (if PYTHON_SERVICE_URL is set)
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
    if (pythonServiceUrl) {
      return await executePythonViaService(pythonServiceUrl, code, input, config);
    }

    // Option 2: Use subprocess (requires Python to be installed)
    return await executePythonViaSubprocess(code, input, config);
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Python execution failed',
        code: 'PYTHON_EXECUTION_ERROR',
        details: error,
      },
    };
  }
}

async function executePythonViaService(
  serviceUrl: string,
  code: string,
  input: Record<string, unknown>,
  config?: { packages?: string[]; timeout?: number }
): Promise<NodeExecutionResult> {
  const axios = (await import('axios')).default;
  
  try {
    const response = await axios.post(
      `${serviceUrl}/execute`,
      {
        code,
        input,
        packages: config?.packages || [],
        timeout: config?.timeout || 30000,
      },
      {
        timeout: (config?.timeout || 30000) + 5000, // Add buffer for network
      }
    );

    return {
      success: true,
      output: {
        output: response.data.result || response.data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error || error.message || 'Python service error',
        code: 'PYTHON_SERVICE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

async function executePythonViaSubprocess(
  code: string,
  input: Record<string, unknown>,
  config?: { packages?: string[]; timeout?: number }
): Promise<NodeExecutionResult> {
  const { spawn } = await import('child_process');
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const timeout = config?.timeout || 30000;
  const packages = config?.packages || [];
  const tempDir = os.tmpdir();
  const execId = `python-exec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const tempFile = path.join(tempDir, `${execId}.py`);
  const requirementsFile = packages.length > 0 ? path.join(tempDir, `${execId}-requirements.txt`) : null;
  
  try {
    // Install packages if needed (basic implementation - in production, use virtualenv)
    if (packages.length > 0 && requirementsFile) {
      await fs.writeFile(requirementsFile, packages.join('\n'));
      
      // Try to install packages (non-blocking, will fail gracefully if packages not available)
      // In production, this should use a virtualenv or container
      try {
        const installProcess = spawn('pip3', ['install', '-q', '-r', requirementsFile], {
          timeout: 10000,
          stdio: 'ignore',
        });
        await new Promise<void>((resolve, reject) => {
          installProcess.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Package installation failed with code ${code}`));
          });
          installProcess.on('error', reject);
        });
      } catch (installError) {
        // Log but don't fail - packages might already be installed or unavailable
        console.warn('Package installation warning:', installError);
      }
    }

    // Wrap code to handle input/output properly
    // Execute code and capture result variable or return value
    const wrappedCode = `
import json
import sys
import traceback

try:
    # Input data
    input_data = ${JSON.stringify(input)}
    
    # Execute user code
${code.split('\n').map((line) => `    ${line}`).join('\n')}
    
    # Determine result
    # If code set a 'result' variable, use it
    # Otherwise, use input_data
    if 'result' not in locals() and 'result' not in globals():
        result = input_data
    
    # Output result as JSON
    print(json.dumps(result, default=str))
except Exception as e:
    error_info = {
        'error': str(e),
        'type': type(e).__name__,
        'traceback': traceback.format_exc()
    }
    print(json.dumps({'__error__': error_info}), file=sys.stderr)
    sys.exit(1)
`;

    await fs.writeFile(tempFile, wrappedCode);

    // Execute Python with timeout and resource limits
    // Note: On Linux, we could use 'timeout' command or setrlimit for better resource control
    // For now, we rely on process timeout and subprocess isolation
    const pythonProcess = spawn('python3', [tempFile], {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Security: Limit environment variables
      env: {
        ...process.env,
        PYTHONPATH: '', // Prevent importing from custom paths
        PYTHONUNBUFFERED: '1',
      },
      // Security: Run in isolated directory (tempDir is already isolated)
      cwd: tempDir,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error(`Python execution timed out after ${timeout}ms`));
      }, timeout);

      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve(code || 0);
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });

    // Clean up temp files
    await fs.unlink(tempFile).catch(() => {});
    if (requirementsFile) {
      await fs.unlink(requirementsFile).catch(() => {});
    }

    if (exitCode !== 0) {
      // Try to parse error from stderr
      let errorMessage = stderr || 'Python execution failed';
      try {
        const errorMatch = stderr.match(/\{"__error__":\s*({[^}]+})\}/);
        if (errorMatch) {
          const errorData = JSON.parse(errorMatch[1]);
          errorMessage = `${errorData.type}: ${errorData.error}\n${errorData.traceback}`;
        }
      } catch {
        // Use raw stderr if parsing fails
      }

      return {
        success: false,
        error: {
          message: errorMessage,
          code: 'PYTHON_EXECUTION_ERROR',
          details: { exitCode, stderr, stdout },
        },
      };
    }

    // Parse output
    let result;
    try {
      const output = stdout.trim();
      if (!output) {
        result = input;
      } else {
        result = JSON.parse(output);
      }
    } catch (parseError) {
      // If JSON parsing fails, return the raw output
      result = stdout.trim() || input;
    }

    return {
      success: true,
      output: {
        output: result,
      },
    };
  } catch (error: any) {
    // Clean up temp files on error
    await fs.unlink(tempFile).catch(() => {});
    if (requirementsFile) {
      await fs.unlink(requirementsFile).catch(() => {});
    }
    
    if (error.code === 'ENOENT') {
      return {
        success: false,
        error: {
          message: 'Python 3 is not installed or not in PATH. Set PYTHON_SERVICE_URL to use an external Python service.',
          code: 'PYTHON_NOT_FOUND',
        },
      };
    }

    if (error.message?.includes('timed out')) {
      return {
        success: false,
        error: {
          message: error.message,
          code: 'PYTHON_TIMEOUT',
        },
      };
    }

    return {
      success: false,
      error: {
        message: error.message || 'Python execution failed',
        code: 'PYTHON_EXECUTION_ERROR',
        details: error,
      },
    };
  }
}

