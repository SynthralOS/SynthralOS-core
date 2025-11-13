import { AgentFramework, AgentFrameworkRegistry } from './agentFramework';
import { AgentConfig, AgentResponse } from './agentService';
import { agentFrameworkRegistry } from './agentFramework';

/**
 * Routing Heuristics
 * 
 * Based on PRD §6 - Agent Routing Logic
 */
export interface RoutingHeuristics {
  // Generic Framework Routing (§6.1)
  agent_type?: 'simple' | 'recursive' | 'multi-role' | 'self-healing' | 'collaborative';
  recursive_planning?: boolean;
  agent_roles?: number;
  agent_self_fix?: boolean;
  intent?: string;
  agents_need_to_communicate?: boolean;
  protocol?: 'modular' | 'langchain';
  agent_rollback?: boolean;
  context_window_lost?: boolean;
  multi_agent_context?: 'short-term' | 'long-term';
  latency?: number;
  user_prefers_copilot_ui?: boolean;

  // Social Media Specific (§6.2)
  task_type?: string;
  platform?: string;
  multi_channel?: boolean;
  agent_source?: 'third_party';
  agent_protocol_required?: 'oap' | 'modular';
  exec_required?: boolean;
  trigger?: string;
  task_complexity?: number;
  tools_required?: boolean;

  // Collaboration & Fallback (§6.3)
  agents?: number;
  communication?: 'delegation' | 'collaboration';
  agent_failure_detected?: boolean;
  input_type?: string;

  // Multi-Agent Builder (§6.4)
  team_logic_required?: boolean;
  parallel_agents_required?: boolean;
  agent_communication?: 'frequent' | 'interdependent';
  org_policy?: string;
  toolchain?: string;
  task_planner?: string;
  agent_skillsets?: number;
  execution_platform?: 'edge' | 'gpu';

  // IBM ACP Routing (§6.5)
  agent_communication_type?: 'external';
  org_scope?: 'cross_workspace';
  delegated_agent?: boolean;
  protocol_required?: 'secure';
  workflow_source?: string;
  oap_not_supported?: boolean;
}

/**
 * Agent Router
 * 
 * Routes tasks to the best-fit agent framework based on heuristics
 */
export class AgentRouter {
  private registry: AgentFrameworkRegistry;

  constructor(registry: AgentFrameworkRegistry = agentFrameworkRegistry) {
    this.registry = registry;
  }

  /**
   * Route a task to the best framework
   */
  route(heuristics: RoutingHeuristics): AgentFramework | null {
    // Convert heuristics to framework requirements
    const requirements = this.convertHeuristicsToRequirements(heuristics);
    
    // Find best framework
    return this.registry.findBestFramework(requirements);
  }

  /**
   * Execute agent with automatic routing and fallback
   */
  async executeWithRouting(
    query: string,
    heuristics: RoutingHeuristics,
    config?: Partial<AgentConfig>,
    context?: Record<string, unknown>,
    maxRetries: number = 2
  ): Promise<AgentResponse> {
    let lastError: Error | null = null;
    const attemptedFrameworks: string[] = [];

    // Try primary framework
    let framework = this.route(heuristics);
    
    if (!framework) {
      throw new Error('No suitable agent framework found for the given requirements');
    }

    // Retry loop with fallback
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Skip if we've already tried this framework
        const frameworkName = framework.getMetadata().name;
        if (attemptedFrameworks.includes(frameworkName)) {
          // Try fallback framework
          framework = this.getFallbackFramework(heuristics, attemptedFrameworks);
          if (!framework) {
            throw new Error('No fallback framework available');
          }
        }

        attemptedFrameworks.push(framework.getMetadata().name);

        // Merge config with framework recommendations
        const recommendedConfig = framework.getRecommendedConfig?.(heuristics) || {};
        const finalConfig: AgentConfig = {
          ...recommendedConfig,
          ...config,
        } as AgentConfig;

        // Validate config
        const validation = framework.validateConfig(finalConfig);
        if (!validation.valid) {
          throw new Error(`Invalid configuration: ${validation.errors?.join(', ')}`);
        }

        // Execute
        return await framework.execute(query, finalConfig, context);
      } catch (error: any) {
        lastError = error;
        
        // If not the last attempt, try fallback
        if (attempt < maxRetries) {
          // Get fallback framework
          framework = this.getFallbackFramework(heuristics, attemptedFrameworks);
          if (!framework) {
            break; // No fallback available
          }
          continue;
        }
      }
    }

    // All attempts failed
    throw new Error(
      `Agent execution failed after ${maxRetries + 1} attempts. ` +
      `Attempted frameworks: ${attemptedFrameworks.join(', ')}. ` +
      `Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Get fallback framework when primary fails
   */
  private getFallbackFramework(
    heuristics: RoutingHeuristics,
    attempted: string[]
  ): AgentFramework | null {
    const allFrameworks = this.registry.getAllFrameworks();
    const available = allFrameworks.filter(f => !attempted.includes(f.getMetadata().name));

    if (available.length === 0) {
      return null;
    }

    // Fallback strategy: try simpler frameworks first
    const sorted = available.sort((a, b) => {
      const aType = a.getMetadata().type;
      const bType = b.getMetadata().type;
      
      // Prefer simpler frameworks for fallback
      const complexity: Record<string, number> = {
        'one-shot': 1,
        'react': 2,
        'recursive': 3,
        'multi-role': 4,
        'collaborative': 5,
      };

      return (complexity[aType] || 99) - (complexity[bType] || 99);
    });

    return sorted[0] || null;
  }

  /**
   * Convert routing heuristics to framework requirements
   */
  private convertHeuristicsToRequirements(
    heuristics: RoutingHeuristics
  ): Parameters<AgentFrameworkRegistry['findBestFramework']>[0] {
    const requirements: Parameters<AgentFrameworkRegistry['findBestFramework']>[0] = {};

    // Map agent_type
    if (heuristics.agent_type) {
      requirements.agent_type = heuristics.agent_type;
    } else {
      // Default to simple for one-shot tasks
      requirements.agent_type = 'simple';
    }

    // Map recursive planning
    if (heuristics.recursive_planning !== undefined) {
      requirements.recursive_planning = heuristics.recursive_planning;
    }

    // Map agent roles
    if (heuristics.agent_roles !== undefined) {
      requirements.agent_roles = heuristics.agent_roles;
    } else if (heuristics.agents && heuristics.agents > 1) {
      requirements.agent_roles = heuristics.agents;
    }

    // Map self-healing
    if (heuristics.agent_self_fix !== undefined) {
      requirements.agent_self_fix = heuristics.agent_self_fix;
    }

    // Map collaboration
    if (heuristics.agents_need_to_communicate !== undefined) {
      requirements.agents_need_to_communicate = heuristics.agents_need_to_communicate;
    } else if (heuristics.agent_communication === 'frequent' || heuristics.agent_communication === 'interdependent') {
      requirements.agents_need_to_communicate = true;
    }

    // Map tools requirement
    if (heuristics.tools_required !== undefined) {
      requirements.tools_required = heuristics.tools_required;
    } else if (heuristics.exec_required) {
      requirements.tools_required = true;
    }

    // Map latency budget
    if (heuristics.latency !== undefined) {
      requirements.latency_budget = heuristics.latency;
    }

    // Map memory requirement
    if (heuristics.multi_agent_context === 'short-term' || heuristics.context_window_lost) {
      requirements.memory_required = true;
    }

    // Task type specific routing
    if (heuristics.task_type) {
      // Social media tasks
      if (heuristics.task_type === 'blog_generation' || heuristics.platform === 'instagram' || heuristics.platform === 'twitter') {
        // These would route to specific frameworks (KUSH AI, Instagram AI, Riona)
        // For now, use collaborative or recursive
        if (!requirements.agent_type) {
          requirements.agent_type = 'collaborative';
        }
      }
      
      // Simple tasks route to one-shot
      if (heuristics.task_type === 'simple' || heuristics.task_type === 'query') {
        requirements.agent_type = 'simple';
        requirements.recursive_planning = false;
      }
      
      // Complex tasks route to recursive
      if (heuristics.task_type === 'complex' || heuristics.task_type === 'planning') {
        requirements.agent_type = 'recursive';
        requirements.recursive_planning = true;
      }
    }

    // Complexity-based routing
    if (heuristics.task_complexity && heuristics.task_complexity > 2) {
      if (!requirements.recursive_planning) {
        requirements.recursive_planning = true;
      }
    }

    // Intent-based routing (§6.1)
    if (heuristics.intent === 'build_agent') {
      // Would route to All-Hands / AutoBuilder (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    // Protocol-based routing (§6.1)
    if (heuristics.protocol === 'langchain') {
      // LangChain Protocol Loader (use ReAct for now)
      requirements.agent_type = 'simple';
    }

    // Rollback routing (§6.1)
    if (heuristics.agent_rollback) {
      // Would use Context7 (not implemented yet)
      requirements.memory_required = true;
    }

    // Context window lost (§6.1)
    if (heuristics.context_window_lost) {
      // Would use Context7 fallback (not implemented yet)
      requirements.memory_required = true;
    }

    // Multi-agent context (§6.1)
    if (heuristics.multi_agent_context === 'short-term') {
      // Would use Context7 shared cache (not implemented yet)
      requirements.memory_required = true;
    }

    // Latency-based routing (§6.1)
    if (heuristics.latency && heuristics.latency > 1000) {
      // High latency, use Context7 → Mem0 → Graphiti (not implemented yet)
      requirements.memory_required = true;
    }

    // Social media routing (§6.2)
    if (heuristics.task_type === 'blog_generation') {
      // Would route to KUSH AI (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    if (heuristics.platform === 'instagram') {
      // Would route to Instagram AI (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    if (heuristics.platform === 'twitter' || heuristics.platform === 'github') {
      // Would route to Riona (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    if (heuristics.multi_channel) {
      // Would route to Kyro (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    // Third-party agent routing (§6.2)
    if (heuristics.agent_source === 'third_party') {
      // Would use Wrapped Agent (LangGraph) - use collaborative for now
      requirements.agent_type = 'collaborative';
    }

    // Protocol requirements (§6.2)
    if (heuristics.agent_protocol_required === 'oap' || heuristics.agent_protocol_required === 'modular') {
      // Would use MCP Wrapped Agent (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    // Execution requirements (§6.2)
    if (heuristics.exec_required) {
      // Would use Open Interpreter (not implemented yet)
      requirements.tools_required = true;
    }

    // Pull request routing (§6.2)
    if (heuristics.trigger === 'pull_request') {
      // Would route to PR-Agent (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    // Creative tasks (§6.2)
    if (heuristics.task_type === 'creative') {
      // Would route to Camel-AI (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    // Complex tasks with tools (§6.2)
    if (heuristics.task_complexity && heuristics.task_complexity > 2 && heuristics.tools_required) {
      // Would route to AutoGen
      requirements.agent_type = 'collaborative';
      requirements.tools_required = true;
    }

    // Collaboration routing (§6.3)
    if (heuristics.agents === 2 && heuristics.communication === 'delegation') {
      // Would use A2A Protocol (not implemented yet)
      requirements.agents_need_to_communicate = true;
    }

    if (heuristics.agent_roles && heuristics.agent_roles > 2) {
      // Would use Swarm + AutoGen
      requirements.agent_type = 'collaborative';
      requirements.agents_need_to_communicate = true;
    }

    if (heuristics.agent_failure_detected) {
      // Would use Swarm for fallback (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    // Declarative/goal-based (§6.3)
    if (heuristics.task_type === 'declarative' || heuristics.task_type === 'goal-based') {
      // Would route to Agent0 (not implemented yet)
      requirements.recursive_planning = true;
    }

    // Plugin/tool use (§6.3)
    if (heuristics.input_type === 'plugin' || heuristics.input_type === 'tool use') {
      // Would use Semantic Kernel (not implemented yet)
      requirements.tools_required = true;
    }

    // GitHub + planning (§6.3)
    if (heuristics.platform === 'github' && heuristics.task_type === 'planning') {
      // Would route to All-Hands / PR-Agent (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    // Social media platform (§6.3)
    if (heuristics.platform === 'social_media') {
      // Would route to Social Media Agent / Riona (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    // Meeting/inbox (§6.3)
    if (heuristics.task_type === 'meeting' || heuristics.task_type === 'inbox') {
      // Would route to Executive Assistant (not implemented yet)
      requirements.agent_type = 'simple';
    }

    // Research tasks (§6.3)
    if (heuristics.task_type === 'research' || heuristics.task_type === 'multi-site') {
      // Would route to Open Deep Research (not implemented yet)
      requirements.recursive_planning = true;
      requirements.tools_required = true;
    }

    // Multi-agent builder routing (§6.4)
    if (heuristics.agent_roles && heuristics.agent_roles > 1 && heuristics.team_logic_required) {
      // Would use AutoGen
      requirements.agent_type = 'collaborative';
      requirements.agents_need_to_communicate = true;
    }

    if (heuristics.parallel_agents_required && heuristics.task_type === 'atomic') {
      // Would use Swarm (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    if (heuristics.agent_communication === 'frequent' || heuristics.agent_communication === 'interdependent') {
      // Would use A2A Protocol (not implemented yet)
      requirements.agents_need_to_communicate = true;
    }

    // Task planner routing (§6.4)
    if (heuristics.task_planner === 'collaborative' && heuristics.agent_skillsets && heuristics.agent_skillsets > 1) {
      // Would use AutoGen + A2A
      requirements.agent_type = 'collaborative';
      requirements.agents_need_to_communicate = true;
    }

    // Execution platform routing (§6.4)
    if (heuristics.execution_platform === 'edge' || heuristics.gpu_required) {
      // Would use Modular Agent Protocol (not implemented yet)
      requirements.agent_type = 'collaborative';
    }

    // IBM ACP Routing (§6.5)
    if (heuristics.agent_communication_type === 'external') {
      // Would use ACP (not implemented yet)
      requirements.agents_need_to_communicate = true;
    }

    if (heuristics.agent_roles && heuristics.agent_roles > 2 && heuristics.org_scope === 'cross_workspace') {
      // Would use ACP (not implemented yet)
      requirements.agents_need_to_communicate = true;
    }

    if (heuristics.delegated_agent && heuristics.protocol_required === 'secure') {
      // Would use ACP (not implemented yet)
      requirements.agents_need_to_communicate = true;
    }

    if (heuristics.workflow_source === 'external_orchestration') {
      // Would use ACP (not implemented yet)
      requirements.agents_need_to_communicate = true;
    }

    if (heuristics.oap_not_supported) {
      // Would use ACP fallback (not implemented yet)
      requirements.agents_need_to_communicate = true;
    }

    return requirements;
  }

  /**
   * Get routing explanation (for debugging/observability)
   */
  explainRouting(heuristics: RoutingHeuristics): {
    selectedFramework: string | null;
    candidates: Array<{ name: string; score: number; reason: string }>;
    heuristics: RoutingHeuristics;
  } {
    const requirements = this.convertHeuristicsToRequirements(heuristics);
    const framework = this.route(heuristics);
    
    // Get all frameworks and score them
    const allFrameworks = this.registry.getAllFrameworks();
    const candidates = allFrameworks.map(f => {
      const metadata = f.getMetadata();
      // Simple scoring (in real implementation, use the same logic as findBestFramework)
      let score = 0;
      let reason = '';

      if (requirements.agent_type && metadata.type === requirements.agent_type) {
        score += 10;
        reason += `Type match (${requirements.agent_type}); `;
      }

      if (requirements.recursive_planning && metadata.capabilities.supportsRecursivePlanning) {
        score += 5;
        reason += 'Supports recursive planning; ';
      }

      if (requirements.agent_roles && requirements.agent_roles > 1 && metadata.capabilities.supportsMultiRole) {
        score += 5;
        reason += `Supports multi-role (${requirements.agent_roles} roles); `;
      }

      return {
        name: metadata.name,
        score,
        reason: reason || 'No specific match',
      };
    });

    candidates.sort((a, b) => b.score - a.score);

    return {
      selectedFramework: framework?.getMetadata().name || null,
      candidates,
      heuristics,
    };
  }
}

export const agentRouter = new AgentRouter();

