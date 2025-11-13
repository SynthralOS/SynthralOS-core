/**
 * Agent Framework Initialization
 * 
 * Registers all available agent frameworks on startup
 */

import { agentFrameworkRegistry } from './agentFramework';
import { ReActFramework } from './frameworks/reactFramework';
import { AgentGPTFramework } from './frameworks/agentGPTFramework';
import { AutoGPTFramework } from './frameworks/autoGPTFramework';
import { MetaGPTFramework } from './frameworks/metaGPTFramework';
import { AutoGenFramework } from './frameworks/autoGenFramework';

/**
 * Initialize and register all agent frameworks
 */
export function initializeAgentFrameworks(): void {
  // Register ReAct framework
  const reactFramework = new ReActFramework();
  agentFrameworkRegistry.register(reactFramework);

  // Register AgentGPT framework
  const agentGPTFramework = new AgentGPTFramework();
  agentFrameworkRegistry.register(agentGPTFramework);

  // Register AutoGPT framework
  const autoGPTFramework = new AutoGPTFramework();
  agentFrameworkRegistry.register(autoGPTFramework);

  // Register MetaGPT framework
  const metaGPTFramework = new MetaGPTFramework();
  agentFrameworkRegistry.register(metaGPTFramework);

  // Register AutoGen framework
  const autoGenFramework = new AutoGenFramework();
  agentFrameworkRegistry.register(autoGenFramework);

  console.log('✅ Agent frameworks initialized:');
  console.log(`   - ${reactFramework.getMetadata().displayName} (${reactFramework.getMetadata().name})`);
  console.log(`   - ${agentGPTFramework.getMetadata().displayName} (${agentGPTFramework.getMetadata().name})`);
  console.log(`   - ${autoGPTFramework.getMetadata().displayName} (${autoGPTFramework.getMetadata().name})`);
  console.log(`   - ${metaGPTFramework.getMetadata().displayName} (${metaGPTFramework.getMetadata().name})`);
  console.log(`   - ${autoGenFramework.getMetadata().displayName} (${autoGenFramework.getMetadata().name})`);
  
  // TODO: Register additional frameworks in future phases
  // - Archon (self-healing)
  // - Swarm (parallel agents)
  // etc.
}

