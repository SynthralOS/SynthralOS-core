import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { aiService } from '../aiService';

export async function executeEmbedding(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const text = (input.text as string) || nodeConfig.text || '';
  if (!text) {
    return {
      success: false,
      error: {
        message: 'Text is required for embedding generation',
        code: 'MISSING_TEXT',
      },
    };
  }

  try {
    const model = nodeConfig.model || 'text-embedding-ada-002';
    const embedding = await aiService.generateEmbedding(text);

    return {
      success: true,
      output: {
        embedding,
        model,
        dimensions: embedding.length,
      },
      metadata: {
        dimensions: embedding.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Embedding generation failed',
        code: 'EMBEDDING_ERROR',
        details: error,
      },
    };
  }
}

