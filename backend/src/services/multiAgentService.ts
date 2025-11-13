import { AgentResponse } from './agentService';
import { agentFrameworkRegistry } from './agentFramework';
import { createId } from '@paralleldrive/cuid2';

/**
 * Multi-Agent Service
 * 
 * Implements A2A (Agent-to-Agent) Protocol for agent communication
 * Supports agent teams, coordination, and task delegation
 */

export interface AgentMessage {
  messageId: string;
  fromAgentId: string;
  toAgentId: string;
  type: 'request' | 'response' | 'delegate' | 'notify';
  content: string;
  payload?: Record<string, unknown>;
  timestamp: Date;
  status: 'pending' | 'delivered' | 'processed' | 'failed';
}

export interface AgentTeam {
  teamId: string;
  name: string;
  agents: Array<{
    agentId: string;
    role: string;
    capabilities: string[];
  }>;
  coordinatorId?: string;
  createdAt: Date;
}

export interface DelegationRequest {
  delegationId: string;
  fromAgentId: string;
  toAgentId: string;
  task: string;
  context?: Record<string, unknown>;
  priority: number;
  deadline?: Date;
  createdAt: Date;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Multi-Agent Service (A2A Protocol Basic)
 */
export class MultiAgentService {
  private teams: Map<string, AgentTeam> = new Map();
  private messages: Map<string, AgentMessage> = new Map();
  private delegations: Map<string, DelegationRequest> = new Map();
  private messageQueues: Map<string, AgentMessage[]> = new Map(); // agentId -> messages

  /**
   * Create an agent team
   */
  createTeam(
    name: string,
    agents: Array<{ agentId: string; role: string; capabilities: string[] }>,
    coordinatorId?: string
  ): string {
    const teamId = createId();
    const team: AgentTeam = {
      teamId,
      name,
      agents,
      coordinatorId,
      createdAt: new Date(),
    };

    this.teams.set(teamId, team);
    return teamId;
  }

  /**
   * Get team by ID
   */
  getTeam(teamId: string): AgentTeam | null {
    return this.teams.get(teamId) || null;
  }

  /**
   * Send message between agents (A2A Protocol)
   */
  async sendMessage(
    fromAgentId: string,
    toAgentId: string,
    type: AgentMessage['type'],
    content: string,
    payload?: Record<string, unknown>
  ): Promise<string> {
    const messageId = createId();
    const message: AgentMessage = {
      messageId,
      fromAgentId,
      toAgentId,
      type,
      content,
      payload,
      timestamp: new Date(),
      status: 'pending',
    };

    this.messages.set(messageId, message);

    // Add to recipient's message queue
    const queue = this.messageQueues.get(toAgentId) || [];
    queue.push(message);
    this.messageQueues.set(toAgentId, queue);

    // Mark as delivered
    message.status = 'delivered';

    return messageId;
  }

  /**
   * Get messages for an agent
   */
  getMessages(agentId: string, status?: AgentMessage['status']): AgentMessage[] {
    const queue = this.messageQueues.get(agentId) || [];
    if (status) {
      return queue.filter(m => m.status === status);
    }
    return queue;
  }

  /**
   * Mark message as processed
   */
  markMessageProcessed(messageId: string): void {
    const message = this.messages.get(messageId);
    if (message) {
      message.status = 'processed';
    }
  }

  /**
   * Delegate task to another agent
   */
  async delegateTask(
    fromAgentId: string,
    toAgentId: string,
    task: string,
    context?: Record<string, unknown>,
    priority: number = 1,
    deadline?: Date
  ): Promise<string> {
    const delegationId = createId();
    const delegation: DelegationRequest = {
      delegationId,
      fromAgentId,
      toAgentId,
      task,
      context,
      priority,
      deadline,
      createdAt: new Date(),
      status: 'pending',
    };

    this.delegations.set(delegationId, delegation);

    // Send delegation message
    await this.sendMessage(
      fromAgentId,
      toAgentId,
      'delegate',
      `Task delegation: ${task}`,
      { delegationId, task, context, priority, deadline }
    );

    return delegationId;
  }

  /**
   * Accept delegation
   */
  acceptDelegation(delegationId: string): void {
    const delegation = this.delegations.get(delegationId);
    if (delegation) {
      delegation.status = 'accepted';
    }
  }

  /**
   * Complete delegation
   */
  completeDelegation(delegationId: string, result: AgentResponse): void {
    const delegation = this.delegations.get(delegationId);
    if (delegation) {
      delegation.status = 'completed';
      
      // Notify original agent
      this.sendMessage(
        delegation.toAgentId,
        delegation.fromAgentId,
        'response',
        `Task completed: ${delegation.task}`,
        { delegationId, result }
      );
    }
  }

  /**
   * Get delegations for an agent
   */
  getDelegations(agentId: string, status?: DelegationRequest['status']): DelegationRequest[] {
    const allDelegations = Array.from(this.delegations.values());
    const filtered = allDelegations.filter(d => 
      d.toAgentId === agentId || d.fromAgentId === agentId
    );
    
    if (status) {
      return filtered.filter(d => d.status === status);
    }
    
    return filtered;
  }

  /**
   * Coordinate team execution
   */
  async coordinateTeam(
    teamId: string,
    task: string,
    context?: Record<string, unknown>
  ): Promise<AgentResponse[]> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const results: AgentResponse[] = [];

    // If coordinator exists, delegate to coordinator
    if (team.coordinatorId) {
      const coordinator = team.agents.find(a => a.agentId === team.coordinatorId);
      if (coordinator) {
        // Coordinator would handle task distribution
        // For now, execute sequentially
        for (const agent of team.agents) {
          if (agent.agentId !== team.coordinatorId) {
            // Delegate subtasks to team members
            const delegationId = await this.delegateTask(
              team.coordinatorId,
              agent.agentId,
              `Subtask for: ${task}`,
              context
            );
            
            // In real implementation, would wait for completion
            // For now, just create delegation
          }
        }
      }
    } else {
      // No coordinator, execute in parallel (simplified)
      for (const agent of team.agents) {
        const delegationId = await this.delegateTask(
          'system',
          agent.agentId,
          task,
          context
        );
      }
    }

    return results;
  }

  /**
   * Find best agent for a task
   */
  findBestAgent(
    task: string,
    requiredCapabilities: string[],
    teamId?: string
  ): string | null {
    const agents = teamId 
      ? (this.teams.get(teamId)?.agents || [])
      : Array.from(this.teams.values()).flatMap(t => t.agents);

    let bestAgent: { agentId: string; score: number } | null = null;

    for (const agent of agents) {
      const matchingCapabilities = agent.capabilities.filter(c => 
        requiredCapabilities.includes(c)
      );
      const score = matchingCapabilities.length / requiredCapabilities.length;

      if (!bestAgent || score > bestAgent.score) {
        bestAgent = { agentId: agent.agentId, score };
      }
    }

    return bestAgent?.agentId || null;
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId: string): {
    pendingMessages: number;
    pendingDelegations: number;
    activeDelegations: number;
  } {
    const messages = this.getMessages(agentId, 'pending');
    const delegations = this.getDelegations(agentId);
    
    return {
      pendingMessages: messages.length,
      pendingDelegations: delegations.filter(d => d.status === 'pending').length,
      activeDelegations: delegations.filter(d => 
        d.status === 'accepted' || d.status === 'in_progress'
      ).length,
    };
  }
}

export const multiAgentService = new MultiAgentService();

