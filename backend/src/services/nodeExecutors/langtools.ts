import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { langtoolsService, ToolConfig } from '../langtoolsService';

/**
 * LangChain Tools Node Executor
 * 
 * Executes LangChain tools (calculator, web search, wikipedia, custom tools)
 */

export async function executeLangTool(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const toolName = (nodeConfig.toolName as string) || (input.toolName as string) || '';
  const toolInput = (input.input as any) || (input.toolInput as any) || input || {};
  const registerTool = (nodeConfig.registerTool as ToolConfig) || null;

  try {
    // Register tool if provided
    if (registerTool) {
      langtoolsService.registerTool(registerTool);
    }

    if (!toolName) {
      // List available tools
      const tools = langtoolsService.getToolNames();
      const toolDetails = tools.map(name => {
        const tool = langtoolsService.getTool(name);
        return {
          name,
          description: tool?.description || '',
        };
      });

      return {
        success: true,
        output: {
          tools: toolDetails,
          count: tools.length,
        },
        metadata: {
          availableTools: tools,
        },
      };
    }

    // Execute tool
    const result = await langtoolsService.executeTool(toolName, toolInput);

    return {
      success: true,
      output: {
        result,
        toolName,
        input: toolInput,
      },
      metadata: {
        toolName,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Tool execution failed',
        code: 'TOOL_ERROR',
        details: error,
      },
    };
  }
}

/**
 * Execute multiple tools in sequence
 */
export async function executeLangTools(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const tools = (nodeConfig.tools as Array<{ name: string; input: any }>) || [];
  const parallel = (nodeConfig.parallel as boolean) || false;

  try {
    if (parallel) {
      // Execute tools in parallel
      const results = await Promise.all(
        tools.map(async (tool) => {
          try {
            const result = await langtoolsService.executeTool(tool.name, tool.input);
            return {
              tool: tool.name,
              success: true,
              result,
            };
          } catch (error: any) {
            return {
              tool: tool.name,
              success: false,
              error: error.message,
            };
          }
        })
      );

      return {
        success: true,
        output: {
          results,
          count: results.length,
        },
      };
    } else {
      // Execute tools sequentially
      const results: any[] = [];
      let currentInput = input;

      for (const tool of tools) {
        try {
          const toolInput = tool.input || currentInput;
          const result = await langtoolsService.executeTool(tool.name, toolInput);
          results.push({
            tool: tool.name,
            success: true,
            result,
          });
          // Pass result to next tool
          currentInput = { previousResult: result, ...currentInput };
        } catch (error: any) {
          results.push({
            tool: tool.name,
            success: false,
            error: error.message,
          });
          // Stop on error if configured
          if (nodeConfig.stopOnError) {
            break;
          }
        }
      }

      return {
        success: true,
        output: {
          results,
          count: results.length,
          finalResult: results[results.length - 1]?.result,
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Tools execution failed',
        code: 'TOOLS_ERROR',
        details: error,
      },
    };
  }
}

