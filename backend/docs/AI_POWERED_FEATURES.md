# AI-Powered Features Documentation

This document describes the AI-powered features available in the code execution system:
- Sandbox Escape Detection
- Code Review Integration
- GPT-4 Code Suggestions

---

## 1. Sandbox Escape Detection

### Overview

The Sandbox Escape Detection service analyzes code for potential escape attempts before execution. It detects suspicious patterns that might indicate attempts to break out of the sandbox environment.

### Features

- **Pattern Detection**: Detects multiple categories of suspicious patterns:
  - File system escape attempts (path traversal, system file access)
  - Process manipulation (fork, exec, spawn)
  - Network escape attempts (raw sockets, DNS resolution)
  - Memory manipulation (mmap, ptrace)
  - System calls (direct syscalls, interrupts)
  - Language-specific patterns (Node.js, Python)

- **Severity Levels**: 
  - `low`: Minor suspicious patterns
  - `medium`: Moderate risk patterns
  - `high`: High-risk patterns (should block)
  - `critical`: Critical escape patterns (must block)

- **Automatic Blocking**: Configurable threshold for automatic code blocking

### Configuration

```env
# Enable sandbox escape detection
ENABLE_SANDBOX_ESCAPE_DETECTION=true
```

### Usage

#### In Code Execution

The service is automatically integrated into the code executor. It analyzes code before execution and can block execution if escape attempts are detected.

```typescript
import { sandboxEscapeDetectionService } from './services/sandboxEscapeDetectionService';

// Analyze code
const result = sandboxEscapeDetectionService.analyzeCode(code, 'javascript');

// Check if should block
if (sandboxEscapeDetectionService.shouldBlock(result, 'high')) {
  // Block execution
}
```

#### API Endpoint

```http
POST /api/v1/code-agents/check-escape
Content-Type: application/json

{
  "code": "const fs = require('fs'); fs.readFile('/etc/passwd', ...)",
  "language": "javascript"
}
```

Response:
```json
{
  "detected": true,
  "severity": "high",
  "patterns": ["fileSystem: /\\/etc\\/passwd/g"],
  "description": "Detected 1 suspicious pattern(s) indicating potential sandbox escape attempt",
  "recommendation": "HIGH: Code contains high-risk escape patterns. Execution should be blocked or heavily restricted."
}
```

### Integration Points

- **Code Executor**: Automatically analyzes code before execution
- **Code Agents API**: Provides endpoint for manual escape detection checks
- **OpenTelemetry**: Traces all escape detection operations

---

## 2. Code Review Integration

### Overview

The Code Review service provides AI-powered code review and analysis using GPT-4 or other LLMs. It can review code for security, performance, best practices, and bugs.

### Features

- **Review Types**:
  - `security`: Focus on security vulnerabilities
  - `performance`: Focus on performance issues
  - `best-practices`: Focus on code quality and conventions
  - `bugs`: Focus on bugs and errors
  - `comprehensive`: Full review covering all aspects

- **Scoring**: Provides scores for:
  - Overall code quality (0-100)
  - Security score (0-100)
  - Performance score (0-100)
  - Maintainability score (0-100)

- **Issue Detection**: Identifies issues with:
  - Severity levels (info, warning, error, critical)
  - Categories (security, performance, bug, style, best-practice)
  - Line numbers (when applicable)
  - Suggestions for fixes

### Configuration

```env
# Enable code review
ENABLE_CODE_REVIEW=true

# Model configuration
CODE_REVIEW_MODEL=gpt-4
CODE_REVIEW_PROVIDER=openai
```

### Usage

#### API Endpoint

```http
POST /api/v1/code-agents/review
Content-Type: application/json

{
  "code": "function process(data) { return data.map(x => x * 2); }",
  "language": "javascript",
  "reviewType": "comprehensive",
  "context": "Processing user input data"
}
```

Response:
```json
{
  "overallScore": 75,
  "securityScore": 80,
  "performanceScore": 70,
  "maintainabilityScore": 75,
  "summary": "Code is generally well-written but could benefit from error handling...",
  "issues": [
    {
      "severity": "warning",
      "category": "best-practice",
      "line": 1,
      "message": "Missing error handling for edge cases",
      "suggestion": "Add null/undefined checks before mapping",
      "codeSnippet": "return data.map(x => x * 2);"
    }
  ],
  "suggestions": [
    "Add input validation",
    "Consider error handling for empty arrays",
    "Add JSDoc comments for documentation"
  ]
}
```

#### Programmatic Usage

```typescript
import { codeReviewService } from './services/codeReviewService';

// Comprehensive review
const review = await codeReviewService.reviewCode({
  code: '...',
  language: 'javascript',
  reviewType: 'comprehensive',
});

// Quick security review
const securityIssues = await codeReviewService.quickSecurityReview(
  code,
  'javascript'
);
```

### Integration Points

- **Code Agents API**: Provides endpoint for code review
- **Sandbox Studio**: Can be integrated into UI for inline reviews
- **OpenTelemetry**: Traces all code review operations

---

## 3. GPT-4 Code Suggestions

### Overview

The Code Suggestion service provides AI-powered code suggestions using GPT-4. It can suggest code improvements, completions, and fixes.

### Features

- **Suggestion Types**:
  - `improve`: General code improvements
  - `complete`: Code completion
  - `fix`: Bug fixes
  - `optimize`: Performance optimizations
  - `document`: Add documentation

- **Confidence Scoring**: Provides confidence level (0-1) for suggestions
- **Change Tracking**: Lists all changes made in suggestions
- **Inline Completion**: IDE-like inline code completion

### Configuration

```env
# Enable code suggestions
ENABLE_CODE_SUGGESTIONS=true

# Model configuration
CODE_SUGGESTION_MODEL=gpt-4
CODE_SUGGESTION_PROVIDER=openai
```

### Usage

#### API Endpoint

```http
POST /api/v1/code-agents/suggestions
Content-Type: application/json

{
  "code": "function add(a, b) { return a + b; }",
  "language": "javascript",
  "suggestionType": "improve",
  "context": "Add two numbers with error handling"
}
```

Response:
```json
{
  "suggestedCode": "function add(a, b) {\n  if (typeof a !== 'number' || typeof b !== 'number') {\n    throw new Error('Both arguments must be numbers');\n  }\n  return a + b;\n}",
  "explanation": "Added type checking and error handling for better robustness",
  "confidence": 0.9,
  "changes": [
    "Added input validation",
    "Added error handling",
    "Improved code robustness"
  ]
}
```

#### Programmatic Usage

```typescript
import { codeSuggestionService } from './services/codeSuggestionService';

// Get suggestions
const suggestion = await codeSuggestionService.getSuggestions({
  code: '...',
  language: 'javascript',
  suggestionType: 'improve',
  context: 'Process user data',
});

// Inline completion
const completion = await codeSuggestionService.getInlineCompletion(
  code,
  'javascript',
  cursorPosition
);
```

### Integration Points

- **Code Agents API**: Provides endpoint for code suggestions
- **Sandbox Studio**: Can be integrated into Monaco editor for inline suggestions
- **OpenTelemetry**: Traces all code suggestion operations

---

## Best Practices

### 1. Sandbox Escape Detection

- **Enable by default** in production environments
- **Set appropriate thresholds** based on your security requirements
- **Monitor detection patterns** to tune false positive rates
- **Review blocked code** to understand attack patterns

### 2. Code Review

- **Use comprehensive reviews** for critical code
- **Use security reviews** before deploying to production
- **Review scores** to track code quality over time
- **Address critical issues** before deployment

### 3. Code Suggestions

- **Use high confidence suggestions** (confidence > 0.7) for automatic application
- **Review suggestions** before applying to critical code
- **Use context** to get more relevant suggestions
- **Combine with code review** for best results

---

## Cost Considerations

All three services use LLM APIs (OpenAI GPT-4 or Anthropic Claude), which incur costs:

- **Sandbox Escape Detection**: Pattern-based (no LLM cost)
- **Code Review**: ~$0.01-0.05 per review (depending on code size)
- **Code Suggestions**: ~$0.01-0.03 per suggestion

**Recommendations**:
- Enable features only when needed
- Use caching for repeated reviews/suggestions
- Set rate limits to control costs
- Monitor usage and costs

---

## Troubleshooting

### Code Review/Suggestions Not Working

1. **Check API Keys**: Ensure `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set
2. **Check Feature Flags**: Ensure `ENABLE_CODE_REVIEW=true` or `ENABLE_CODE_SUGGESTIONS=true`
3. **Check Model Availability**: Verify the configured model is available
4. **Check Rate Limits**: Ensure you're not hitting API rate limits

### False Positives in Escape Detection

1. **Review Patterns**: Check which patterns are triggering
2. **Adjust Thresholds**: Lower the blocking threshold if needed
3. **Whitelist Patterns**: Add legitimate patterns to whitelist
4. **Review Code**: Manually review flagged code

---

## Future Enhancements

- **Caching**: Cache reviews and suggestions for identical code
- **Batch Processing**: Review/suggest multiple code snippets at once
- **Custom Models**: Support for fine-tuned models
- **Feedback Loop**: Learn from user feedback on suggestions
- **Multi-language Support**: Enhanced support for more languages

