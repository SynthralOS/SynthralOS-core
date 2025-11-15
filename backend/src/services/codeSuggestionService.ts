import { aiService } from './aiService';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Code Suggestion Service
 * 
 * Provides AI-powered code suggestions using GPT-4 or other LLMs.
 * Can suggest code improvements, completions, and fixes.
 */

export interface CodeSuggestionRequest {
  code: string;
  language: 'javascript' | 'python' | 'typescript' | 'bash';
  context?: string; // What the code should do
  suggestionType?: 'improve' | 'complete' | 'fix' | 'optimize' | 'document';
  cursorPosition?: number; // For completion suggestions
}

export interface CodeSuggestion {
  suggestedCode: string;
  explanation: string;
  confidence: number; // 0-1
  changes: string[]; // List of changes made
}

export class CodeSuggestionService {
  private enabled: boolean;
  private model: string;
  private provider: 'openai' | 'anthropic';

  constructor() {
    this.enabled = process.env.ENABLE_CODE_SUGGESTIONS === 'true';
    this.model = process.env.CODE_SUGGESTION_MODEL || 'gpt-4';
    this.provider = (process.env.CODE_SUGGESTION_PROVIDER || 'openai') as 'openai' | 'anthropic';
  }

  /**
   * Check if code suggestions are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get code suggestions
   */
  async getSuggestions(request: CodeSuggestionRequest): Promise<CodeSuggestion | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const tracer = trace.getTracer('sos-code-suggestion');
    const span = tracer.startSpan('code_suggestion.get', {
      attributes: {
        'code_suggestion.language': request.language,
        'code_suggestion.type': request.suggestionType || 'improve',
        'code_suggestion.code_length': request.code.length,
        'code_suggestion.model': this.model,
        'code_suggestion.provider': this.provider,
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
            content: 'You are an expert code reviewer and assistant. Provide helpful, accurate code suggestions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more focused suggestions
        maxTokens: 2000,
      });

      const suggestion = this.parseResponse(response.text, request);
      
      span.setAttributes({
        'code_suggestion.confidence': suggestion.confidence,
        'code_suggestion.changes_count': suggestion.changes.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return suggestion;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      
      console.error('Code suggestion error:', error);
      return null;
    } finally {
      span.end();
    }
  }

  /**
   * Build prompt for code suggestion
   */
  private buildPrompt(request: CodeSuggestionRequest): string {
    const { code, language, context, suggestionType = 'improve', cursorPosition } = request;

    let prompt = `Please provide a code suggestion for the following ${language} code:\n\n`;
    prompt += '```' + language + '\n';
    prompt += code;
    prompt += '\n```\n\n';

    if (context) {
      prompt += `Context: ${context}\n\n`;
    }

    switch (suggestionType) {
      case 'improve':
        prompt += 'Please suggest improvements to this code, including:\n';
        prompt += '- Better practices\n';
        prompt += '- Performance optimizations\n';
        prompt += '- Error handling\n';
        prompt += '- Code clarity\n';
        break;
      case 'complete':
        if (cursorPosition !== undefined) {
          prompt += `Please complete the code at position ${cursorPosition}.\n`;
        } else {
          prompt += 'Please complete this code snippet.\n';
        }
        break;
      case 'fix':
        prompt += 'Please identify and fix any bugs or issues in this code.\n';
        break;
      case 'optimize':
        prompt += 'Please optimize this code for better performance.\n';
        break;
      case 'document':
        prompt += 'Please add comprehensive documentation (comments, docstrings) to this code.\n';
        break;
    }

    prompt += '\nPlease respond in the following JSON format:\n';
    prompt += '{\n';
    prompt += '  "suggestedCode": "the improved code",\n';
    prompt += '  "explanation": "brief explanation of changes",\n';
    prompt += '  "confidence": 0.0-1.0,\n';
    prompt += '  "changes": ["list", "of", "changes", "made"]\n';
    prompt += '}\n';

    return prompt;
  }

  /**
   * Parse LLM response into CodeSuggestion
   */
  private parseResponse(response: string, request: CodeSuggestionRequest): CodeSuggestion {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggestedCode: parsed.suggestedCode || request.code,
          explanation: parsed.explanation || 'No explanation provided',
          confidence: parsed.confidence || 0.5,
          changes: parsed.changes || [],
        };
      }
    } catch (error) {
      console.warn('Failed to parse code suggestion response as JSON:', error);
    }

    // Fallback: treat entire response as suggested code
    return {
      suggestedCode: response.trim(),
      explanation: 'AI-generated code suggestion',
      confidence: 0.5,
      changes: ['Code suggestion provided'],
    };
  }

  /**
   * Get inline completion suggestions (for IDE-like experience)
   */
  async getInlineCompletion(
    code: string,
    language: 'javascript' | 'python' | 'typescript' | 'bash',
    cursorPosition: number
  ): Promise<string | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const beforeCursor = code.substring(0, cursorPosition);
    const afterCursor = code.substring(cursorPosition);

    const suggestion = await this.getSuggestions({
      code: beforeCursor,
      language,
      suggestionType: 'complete',
      cursorPosition,
    });

    if (suggestion && suggestion.confidence > 0.6) {
      // Extract the completion part (code after the original)
      const suggestedCode = suggestion.suggestedCode;
      if (suggestedCode.length > beforeCursor.length) {
        return suggestedCode.substring(beforeCursor.length);
      }
    }

    return null;
  }
}

export const codeSuggestionService = new CodeSuggestionService();

