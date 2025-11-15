import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Sandbox Escape Detection Service
 * 
 * Detects potential sandbox escape attempts in code execution.
 * Monitors for suspicious patterns and behaviors that might indicate
 * attempts to break out of the sandbox environment.
 */

export interface EscapeDetectionResult {
  detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  patterns: string[];
  description: string;
  recommendation?: string;
}

export class SandboxEscapeDetectionService {
  private enabled: boolean;

  // Suspicious patterns that might indicate escape attempts
  private suspiciousPatterns = {
    // File system escape attempts
    fileSystem: [
      /\.\.\/\.\.\//g, // Path traversal
      /\.\.\\\.\.\\/g, // Windows path traversal
      /\/etc\/passwd/g, // System file access
      /\/proc\/self/g, // Process information access
      /\/sys\//g, // System information access
      /\/dev\//g, // Device access
      /chroot|mount|umount/g, // Filesystem manipulation
    ],
    
    // Process manipulation
    process: [
      /fork|exec|spawn|system/g, // Process creation
      /kill|signal/g, // Process control
      /ptrace|debug/g, // Debugging tools
      /proc\/self\/exe/g, // Process executable access
    ],
    
    // Network escape attempts
    network: [
      /socket|connect|bind|listen/g, // Raw sockets
      /gethostbyname|getaddrinfo/g, // DNS resolution
      /curl|wget|fetch|http/g, // Network requests (if blocked)
    ],
    
    // Memory manipulation
    memory: [
      /mmap|munmap|mprotect/g, // Memory mapping
      /ptrace|readmem|writemem/g, // Memory access
      /dlopen|dlsym/g, // Dynamic library loading
    ],
    
    // System calls
    syscalls: [
      /syscall|__syscall/g, // Direct system calls
      /int\s+0x80/g, // Linux syscall interrupt
      /sysenter|sysexit/g, // Fast syscall
    ],
    
    // JavaScript/Node.js specific
    nodejs: [
      /child_process|cluster|worker_threads/g, // Process creation
      /require\(['"]fs['"]\)/g, // File system (if blocked)
      /require\(['"]net['"]\)/g, // Network (if blocked)
      /process\.exit|process\.kill/g, // Process control
      /eval|Function|setTimeout|setInterval/g, // Code execution
      /Buffer\.from|Buffer\.alloc/g, // Buffer manipulation
    ],
    
    // Python specific
    python: [
      /__import__|importlib/g, // Dynamic imports
      /exec|eval|compile/g, // Code execution
      /os\.system|os\.popen|subprocess/g, // Process creation
      /ctypes|CFFI/g, // C library access
      /mmap|ctypes\.cdll/g, // Memory/C library access
    ],
  };

  constructor() {
    this.enabled = process.env.ENABLE_SANDBOX_ESCAPE_DETECTION === 'true';
  }

  /**
   * Check if escape detection is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Analyze code for potential escape attempts
   */
  analyzeCode(code: string, language: 'javascript' | 'python' | 'typescript' | 'bash'): EscapeDetectionResult {
    if (!this.isEnabled()) {
      return {
        detected: false,
        severity: 'low',
        patterns: [],
        description: 'Sandbox escape detection is disabled',
      };
    }

    const tracer = trace.getTracer('sos-sandbox-escape-detection');
    const span = tracer.startSpan('sandbox_escape.analyze', {
      attributes: {
        'sandbox_escape.language': language,
        'sandbox_escape.code_length': code.length,
      },
    });

    try {
      const detectedPatterns: string[] = [];
      let maxSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

      // Check all pattern categories
      for (const [category, patterns] of Object.entries(this.suspiciousPatterns)) {
        // Skip language-specific patterns that don't match
        if (category === 'nodejs' && language !== 'javascript' && language !== 'typescript') {
          continue;
        }
        if (category === 'python' && language !== 'python') {
          continue;
        }

        for (const pattern of patterns) {
          const matches = code.match(pattern);
          if (matches) {
            detectedPatterns.push(`${category}: ${pattern.source}`);
            
            // Determine severity based on category
            if (category === 'syscalls' || category === 'memory') {
              maxSeverity = this.upgradeSeverity(maxSeverity, 'critical');
            } else if (category === 'process' || category === 'fileSystem') {
              maxSeverity = this.upgradeSeverity(maxSeverity, 'high');
            } else if (category === 'network' || category === 'nodejs' || category === 'python') {
              maxSeverity = this.upgradeSeverity(maxSeverity, 'medium');
            }
          }
        }
      }

      const detected = detectedPatterns.length > 0;

      span.setAttributes({
        'sandbox_escape.detected': detected,
        'sandbox_escape.severity': maxSeverity,
        'sandbox_escape.patterns_count': detectedPatterns.length,
      });
      span.setStatus({
        code: detected ? SpanStatusCode.ERROR : SpanStatusCode.OK,
        message: detected ? 'Potential escape attempt detected' : 'No escape attempts detected',
      });

      return {
        detected,
        severity: maxSeverity,
        patterns: detectedPatterns,
        description: detected
          ? `Detected ${detectedPatterns.length} suspicious pattern(s) indicating potential sandbox escape attempt`
          : 'No suspicious patterns detected',
        recommendation: detected
          ? this.getRecommendation(maxSeverity, detectedPatterns)
          : undefined,
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });

      // On error, be conservative and flag as suspicious
      return {
        detected: true,
        severity: 'medium',
        patterns: ['analysis_error'],
        description: `Error during escape detection analysis: ${error.message}`,
        recommendation: 'Review code manually before execution',
      };
    } finally {
      span.end();
    }
  }

  /**
   * Upgrade severity level
   */
  private upgradeSeverity(
    current: 'low' | 'medium' | 'high' | 'critical',
    newLevel: 'low' | 'medium' | 'high' | 'critical'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const levels = { low: 0, medium: 1, high: 2, critical: 3 };
    return levels[newLevel] > levels[current] ? newLevel : current;
  }

  /**
   * Get recommendation based on severity
   */
  private getRecommendation(
    severity: 'low' | 'medium' | 'high' | 'critical',
    patterns: string[]
  ): string {
    switch (severity) {
      case 'critical':
        return 'CRITICAL: Code contains critical escape patterns. Execution should be blocked. Review code manually.';
      case 'high':
        return 'HIGH: Code contains high-risk escape patterns. Execution should be blocked or heavily restricted.';
      case 'medium':
        return 'MEDIUM: Code contains suspicious patterns. Review code before execution and consider additional restrictions.';
      case 'low':
        return 'LOW: Code contains minor suspicious patterns. Monitor execution closely.';
      default:
        return 'Review code before execution.';
    }
  }

  /**
   * Check if code should be blocked based on analysis
   */
  shouldBlock(result: EscapeDetectionResult, blockThreshold: 'low' | 'medium' | 'high' | 'critical' = 'high'): boolean {
    if (!result.detected) {
      return false;
    }

    const levels = { low: 0, medium: 1, high: 2, critical: 3 };
    return levels[result.severity] >= levels[blockThreshold];
  }
}

export const sandboxEscapeDetectionService = new SandboxEscapeDetectionService();

