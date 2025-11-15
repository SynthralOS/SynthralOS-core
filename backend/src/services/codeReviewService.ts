import { aiService } from './aiService';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Code Review Service
 * 
 * Provides AI-powered code review and analysis.
 * Can review code for security, performance, best practices, and bugs.
 */

export interface CodeReviewRequest {
  code: string;
  language: 'javascript' | 'python' | 'typescript' | 'bash';
  reviewType?: 'security' | 'performance' | 'best-practices' | 'bugs' | 'comprehensive';
  context?: string;
}

export interface CodeReviewResult {
  overallScore: number; // 0-100
  issues: CodeReviewIssue[];
  suggestions: string[];
  summary: string;
  securityScore?: number;
  performanceScore?: number;
  maintainabilityScore?: number;
}

export interface CodeReviewIssue {
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'security' | 'performance' | 'bug' | 'style' | 'best-practice';
  line?: number;
  message: string;
  suggestion?: string;
  codeSnippet?: string;
}

export class CodeReviewService {
  private enabled: boolean;
  private model: string;
  private provider: 'openai' | 'anthropic';

  constructor() {
    this.enabled = process.env.ENABLE_CODE_REVIEW === 'true';
    this.model = process.env.CODE_REVIEW_MODEL || 'gpt-4';
    this.provider = (process.env.CODE_REVIEW_PROVIDER || 'openai') as 'openai' | 'anthropic';
  }

  /**
   * Check if code review is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Review code
   */
  async reviewCode(request: CodeReviewRequest): Promise<CodeReviewResult | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const tracer = trace.getTracer('sos-code-review');
    const span = tracer.startSpan('code_review.review', {
      attributes: {
        'code_review.language': request.language,
        'code_review.type': request.reviewType || 'comprehensive',
        'code_review.code_length': request.code.length,
        'code_review.model': this.model,
        'code_review.provider': this.provider,
      },
    });

    try {
      const prompt = this.buildPrompt(request);
      
      const response = await aiService.generateText({
        provider: this.provider,
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer. Provide thorough, accurate code reviews with specific, actionable feedback.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2, // Lower temperature for more consistent reviews
        maxTokens: 3000,
      });

      const review = this.parseResponse(response.text, request);
      
      span.setAttributes({
        'code_review.overall_score': review.overallScore,
        'code_review.issues_count': review.issues.length,
        'code_review.security_score': review.securityScore || 0,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return review;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      
      console.error('Code review error:', error);
      return null;
    } finally {
      span.end();
    }
  }

  /**
   * Build prompt for code review
   */
  private buildPrompt(request: CodeReviewRequest): string {
    const { code, language, reviewType = 'comprehensive', context } = request;

    let prompt = `Please review the following ${language} code:\n\n`;
    prompt += '```' + language + '\n';
    prompt += code;
    prompt += '\n```\n\n';

    if (context) {
      prompt += `Context: ${context}\n\n`;
    }

    switch (reviewType) {
      case 'security':
        prompt += 'Focus on security issues:\n';
        prompt += '- Vulnerabilities (SQL injection, XSS, etc.)\n';
        prompt += '- Authentication/authorization issues\n';
        prompt += '- Data exposure risks\n';
        prompt += '- Input validation problems\n';
        prompt += '- Secure coding practices\n';
        break;
      case 'performance':
        prompt += 'Focus on performance issues:\n';
        prompt += '- Algorithm efficiency\n';
        prompt += '- Memory usage\n';
        prompt += '- I/O operations\n';
        prompt += '- Caching opportunities\n';
        prompt += '- Optimization suggestions\n';
        break;
      case 'best-practices':
        prompt += 'Focus on best practices:\n';
        prompt += '- Code style and conventions\n';
        prompt += '- Design patterns\n';
        prompt += '- Error handling\n';
        prompt += '- Documentation\n';
        prompt += '- Maintainability\n';
        break;
      case 'bugs':
        prompt += 'Focus on bugs and errors:\n';
        prompt += '- Logic errors\n';
        prompt += '- Edge cases\n';
        prompt += '- Type errors\n';
        prompt += '- Runtime errors\n';
        break;
      case 'comprehensive':
      default:
        prompt += 'Provide a comprehensive review covering:\n';
        prompt += '- Security issues\n';
        prompt += '- Performance concerns\n';
        prompt += '- Bugs and errors\n';
        prompt += '- Best practices\n';
        prompt += '- Code quality\n';
        break;
    }

    prompt += '\nPlease respond in the following JSON format:\n';
    prompt += '{\n';
    prompt += '  "overallScore": 0-100,\n';
    prompt += '  "securityScore": 0-100 (optional),\n';
    prompt += '  "performanceScore": 0-100 (optional),\n';
    prompt += '  "maintainabilityScore": 0-100 (optional),\n';
    prompt += '  "summary": "overall review summary",\n';
    prompt += '  "issues": [\n';
    prompt += '    {\n';
    prompt += '      "severity": "info|warning|error|critical",\n';
    prompt += '      "category": "security|performance|bug|style|best-practice",\n';
    prompt += '      "line": line_number (optional),\n';
    prompt += '      "message": "issue description",\n';
    prompt += '      "suggestion": "how to fix" (optional),\n';
    prompt += '      "codeSnippet": "relevant code" (optional)\n';
    prompt += '    }\n';
    prompt += '  ],\n';
    prompt += '  "suggestions": ["list", "of", "general", "suggestions"]\n';
    prompt += '}\n';

    return prompt;
  }

  /**
   * Parse LLM response into CodeReviewResult
   */
  private parseResponse(response: string, request: CodeReviewRequest): CodeReviewResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          overallScore: parsed.overallScore || 50,
          securityScore: parsed.securityScore,
          performanceScore: parsed.performanceScore,
          maintainabilityScore: parsed.maintainabilityScore,
          issues: parsed.issues || [],
          suggestions: parsed.suggestions || [],
          summary: parsed.summary || 'Code review completed',
        };
      }
    } catch (error) {
      console.warn('Failed to parse code review response as JSON:', error);
    }

    // Fallback: create basic review from text
    return {
      overallScore: 50,
      issues: [
        {
          severity: 'info',
          category: 'best-practice',
          message: 'AI-generated code review',
        },
      ],
      suggestions: [response.trim()],
      summary: 'Code review completed (parsed from text response)',
    };
  }

  /**
   * Quick security review (faster, less detailed)
   */
  async quickSecurityReview(
    code: string,
    language: 'javascript' | 'python' | 'typescript' | 'bash'
  ): Promise<CodeReviewIssue[] | null> {
    const review = await this.reviewCode({
      code,
      language,
      reviewType: 'security',
    });

    if (!review) {
      return null;
    }

    // Return only security-related issues
    return review.issues.filter(issue => issue.category === 'security');
  }
}

export const codeReviewService = new CodeReviewService();

