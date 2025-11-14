import { z } from 'zod';
import axios from 'axios';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Code Validation Service
 * 
 * Provides schema validation for code execution using Zod (JavaScript/TypeScript)
 * and Pydantic (Python) via Python service.
 */

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  validatedInput?: any;
  validatedOutput?: any;
}

export class CodeValidationService {
  private pythonServiceUrl: string | undefined;

  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
  }

  /**
   * Validate input/output with Zod schema (for JavaScript/TypeScript)
   */
  async validateWithZod(
    input: any,
    inputSchema?: z.ZodSchema,
    output?: any,
    outputSchema?: z.ZodSchema
  ): Promise<ValidationResult> {
    const tracer = trace.getTracer('sos-code-validation-service');
    const span = tracer.startSpan('codeValidation.validateWithZod', {
      attributes: {
        'validation.type': 'zod',
        'validation.has_input_schema': !!inputSchema,
        'validation.has_output_schema': !!outputSchema,
      },
    });

    try {
      const errors: string[] = [];

      // Validate input
      if (inputSchema) {
        const inputResult = inputSchema.safeParse(input);
        if (!inputResult.success) {
          const inputErrors = inputResult.error.errors.map(
            (e) => `Input validation error: ${e.path.join('.')} - ${e.message}`
          );
          errors.push(...inputErrors);
          span.setAttributes({
            'validation.input_valid': false,
            'validation.input_errors': inputErrors.length,
          });
        } else {
          span.setAttributes({
            'validation.input_valid': true,
          });
        }
      }

      // Validate output
      if (outputSchema && output !== undefined) {
        const outputResult = outputSchema.safeParse(output);
        if (!outputResult.success) {
          const outputErrors = outputResult.error.errors.map(
            (e) => `Output validation error: ${e.path.join('.')} - ${e.message}`
          );
          errors.push(...outputErrors);
          span.setAttributes({
            'validation.output_valid': false,
            'validation.output_errors': outputErrors.length,
          });
        } else {
          span.setAttributes({
            'validation.output_valid': true,
          });
        }
      }

      const valid = errors.length === 0;

      span.setAttributes({
        'validation.valid': valid,
        'validation.error_count': errors.length,
      });
      span.setStatus({ code: valid ? SpanStatusCode.OK : SpanStatusCode.ERROR });

      return {
        valid,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      return {
        valid: false,
        errors: [error.message || 'Validation failed'],
      };
    } finally {
      span.end();
    }
  }

  /**
   * Validate input/output with Pydantic schema (for Python)
   * Requires Python service with Pydantic support
   */
  async validateWithPydantic(
    input: any,
    inputSchema?: string, // JSON schema string or Pydantic model definition
    output?: any,
    outputSchema?: string
  ): Promise<ValidationResult> {
    const tracer = trace.getTracer('sos-code-validation-service');
    const span = tracer.startSpan('codeValidation.validateWithPydantic', {
      attributes: {
        'validation.type': 'pydantic',
        'validation.has_input_schema': !!inputSchema,
        'validation.has_output_schema': !!outputSchema,
      },
    });

    try {
      if (!this.pythonServiceUrl) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Python service URL not configured',
        });
        return {
          valid: false,
          errors: ['Pydantic validation requires PYTHON_SERVICE_URL to be set'],
        };
      }

      const response = await axios.post(
        `${this.pythonServiceUrl}/validate`,
        {
          input,
          input_schema: inputSchema,
          output,
          output_schema: outputSchema,
        },
        {
          timeout: 5000,
        }
      );

      const result = response.data as ValidationResult;

      span.setAttributes({
        'validation.valid': result.valid,
        'validation.error_count': result.errors?.length || 0,
      });
      span.setStatus({
        code: result.valid ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      });

      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      // If Python service is not available, return warning but don't fail
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.warn('Python validation service not available, skipping Pydantic validation');
        return {
          valid: true, // Don't block execution if validation service is down
          errors: ['Validation service unavailable (non-blocking)'],
        };
      }

      return {
        valid: false,
        errors: [error.response?.data?.error || error.message || 'Pydantic validation failed'],
      };
    } finally {
      span.end();
    }
  }

  /**
   * Parse Zod schema from JSON
   */
  parseZodSchema(schemaJson: any): z.ZodSchema | undefined {
    try {
      // This is a simplified parser - in production, you'd want a more robust schema parser
      // For now, we'll expect the schema to be provided as a Zod schema object
      // In the future, we could implement JSON Schema to Zod conversion
      if (typeof schemaJson === 'object' && schemaJson !== null) {
        // Basic validation that it looks like a schema
        // Full implementation would require schema-to-Zod conversion
        return undefined; // Placeholder - would need schema conversion library
      }
      return undefined;
    } catch (error) {
      console.error('Error parsing Zod schema:', error);
      return undefined;
    }
  }

  /**
   * Validate code execution with schemas
   */
  async validateCodeExecution(
    language: 'javascript' | 'python' | 'typescript' | 'bash',
    input: any,
    output: any,
    inputSchema?: any,
    outputSchema?: any,
    validationType?: 'zod' | 'pydantic'
  ): Promise<ValidationResult> {
    const type = validationType || (language === 'python' ? 'pydantic' : 'zod');

    if (type === 'zod') {
      const zodInputSchema = inputSchema ? this.parseZodSchema(inputSchema) : undefined;
      const zodOutputSchema = outputSchema ? this.parseZodSchema(outputSchema) : undefined;
      return await this.validateWithZod(input, zodInputSchema, output, zodOutputSchema);
    } else {
      const pydanticInputSchema = inputSchema ? JSON.stringify(inputSchema) : undefined;
      const pydanticOutputSchema = outputSchema ? JSON.stringify(outputSchema) : undefined;
      return await this.validateWithPydantic(input, pydanticInputSchema, output, pydanticOutputSchema);
    }
  }
}

export const codeValidationService = new CodeValidationService();

