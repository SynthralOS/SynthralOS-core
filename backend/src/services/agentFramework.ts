import { AgentResponse, AgentConfig } from './agentService';

/**
 * Agent Framework Abstraction Layer
 * 
 * Provides a unified interface for all agent frameworks.
 * Each framework (AgentGPT, AutoGPT, MetaGPT, etc.) implements this interface.
 */

export type AgentFrameworkType = 
  | 'one-shot'           // Simple prompt → task (AgentGPT)
  | 'recursive'          // Goal decomposition (AutoGPT, BabyAGI)
  | 'multi-role'         // Multi-role teamwork (MetaGPT, CrewAI)
  | 'self-healing'       // Self-debugging loop (Archon)
  | 'collaborative'      // Agent collaboration (AutoGen, Swarm)
  | 'react';             // Reasoning + Acting (ReAct)

export interface AgentFrameworkCapabilities {
  supportsRecursivePlanning: boolean;
  supportsMultiRole: boolean;
  supportsSelfHealing: boolean;
  supportsCollaboration: boolean;
  supportsToolUse: boolean;
  supportsMemory: boolean;
  maxRoles?: number;
  maxIterations?: number;
  estimatedLatencyMs?: number;
  costPer1kTokens?: number;
}

export interface AgentFrameworkMetadata {
  name: string;
  displayName: string;
  description: string;
  type: AgentFrameworkType;
  capabilities: AgentFrameworkCapabilities;
  version: string;
  author?: string;
  documentation?: string;
  supportedFeatures: string[];
}

/**
 * Agent Framework Interface
 * 
 * All agent frameworks must implement this interface
 */
export interface AgentFramework {
  /**
   * Get framework metadata
   */
  getMetadata(): AgentFrameworkMetadata;

  /**
   * Check if framework supports a specific feature
   */
  supportsFeature(feature: string): boolean;

  /**
   * Execute agent with query
   */
  execute(
    query: string,
    config: AgentConfig,
    context?: Record<string, unknown>
  ): Promise<AgentResponse>;

  /**
   * Stream agent execution (optional)
   */
  stream?(
    query: string,
    config: AgentConfig,
    context?: Record<string, unknown>
  ): AsyncGenerator<Partial<AgentResponse>, void, unknown>;

  /**
   * Validate configuration
   */
  validateConfig(config: AgentConfig): { valid: boolean; errors?: string[] };

  /**
   * Get required tools for this framework
   */
  getRequiredTools?(): string[];

  /**
   * Get recommended configuration
   */
  getRecommendedConfig?(requirements: Record<string, unknown>): Partial<AgentConfig>;
}

/**
 * Agent Framework Registry
 * 
 * Manages all available agent frameworks and provides routing logic
 */
export class AgentFrameworkRegistry {
  private frameworks: Map<string, AgentFramework> = new Map();
  private metadataCache: Map<string, AgentFrameworkMetadata> = new Map();

  /**
   * Register an agent framework
   */
  register(framework: AgentFramework): void {
    const metadata = framework.getMetadata();
    this.frameworks.set(metadata.name, framework);
    this.metadataCache.set(metadata.name, metadata);
  }

  /**
   * Get a framework by name
   */
  getFramework(name: string): AgentFramework | null {
    return this.frameworks.get(name) || null;
  }

  /**
   * Get all registered frameworks
   */
  getAllFrameworks(): AgentFramework[] {
    return Array.from(this.frameworks.values());
  }

  /**
   * Get all framework metadata
   */
  getAllMetadata(): AgentFrameworkMetadata[] {
    return Array.from(this.metadataCache.values());
  }

  /**
   * Find best framework based on requirements
   */
  findBestFramework(requirements: {
    agent_type?: 'simple' | 'recursive' | 'multi-role' | 'self-healing' | 'collaborative';
    recursive_planning?: boolean;
    agent_roles?: number;
    agent_self_fix?: boolean;
    agents_need_to_communicate?: boolean;
    task_type?: string;
    platform?: string;
    latency_budget?: number;
    tools_required?: boolean;
    memory_required?: boolean;
  }): AgentFramework | null {
    const candidates = this.getAllFrameworks();
    
    if (candidates.length === 0) {
      return null;
    }

    // Score each framework based on requirements
    const scored = candidates.map(framework => {
      const metadata = framework.getMetadata();
      const capabilities = metadata.capabilities;
      let score = 0;

      // Agent type matching
      if (requirements.agent_type === 'simple' && metadata.type === 'one-shot') {
        score += 10;
      } else if (requirements.agent_type === 'recursive' && metadata.type === 'recursive') {
        score += 10;
      } else if (requirements.agent_type === 'multi-role' && metadata.type === 'multi-role') {
        score += 10;
      } else if (requirements.agent_type === 'self-healing' && metadata.type === 'self-healing') {
        score += 10;
      } else if (requirements.agent_type === 'collaborative' && metadata.type === 'collaborative') {
        score += 10;
      }

      // Feature matching
      if (requirements.recursive_planning && capabilities.supportsRecursivePlanning) {
        score += 5;
      }
      if (requirements.agent_roles && requirements.agent_roles > 1) {
        if (capabilities.supportsMultiRole) {
          score += 5;
          if (capabilities.maxRoles && capabilities.maxRoles >= requirements.agent_roles) {
            score += 3;
          }
        }
      }
      if (requirements.agent_self_fix && capabilities.supportsSelfHealing) {
        score += 5;
      }
      if (requirements.agents_need_to_communicate && capabilities.supportsCollaboration) {
        score += 5;
      }
      if (requirements.tools_required && capabilities.supportsToolUse) {
        score += 3;
      }
      if (requirements.memory_required && capabilities.supportsMemory) {
        score += 3;
      }

      // Latency budget
      if (requirements.latency_budget && capabilities.estimatedLatencyMs) {
        if (capabilities.estimatedLatencyMs <= requirements.latency_budget) {
          score += 2;
        } else {
          score -= 5; // Penalize if over budget
        }
      }

      return { framework, score, metadata };
    });

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Return highest scoring framework (if score > 0)
    return scored[0]?.score > 0 ? scored[0].framework : candidates[0];
  }

  /**
   * Search frameworks by query
   */
  search(query: string): AgentFrameworkMetadata[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllMetadata().filter(metadata => {
      return (
        metadata.name.toLowerCase().includes(lowerQuery) ||
        metadata.displayName.toLowerCase().includes(lowerQuery) ||
        metadata.description.toLowerCase().includes(lowerQuery) ||
        metadata.type.toLowerCase().includes(lowerQuery) ||
        metadata.supportedFeatures.some(f => f.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Get frameworks by type
   */
  getByType(type: AgentFrameworkType): AgentFramework[] {
    return this.getAllFrameworks().filter(f => f.getMetadata().type === type);
  }

  /**
   * Check if a framework is registered
   */
  hasFramework(name: string): boolean {
    return this.frameworks.has(name);
  }

  /**
   * Unregister a framework
   */
  unregister(name: string): boolean {
    const removed = this.frameworks.delete(name);
    this.metadataCache.delete(name);
    return removed;
  }
}

// Global registry instance
export const agentFrameworkRegistry = new AgentFrameworkRegistry();

