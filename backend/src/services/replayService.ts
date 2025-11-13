import { db } from '../config/database';
import { workflowExecutions, executionSteps, workflows } from '../../drizzle/schema';
import { eq, and, asc } from 'drizzle-orm';
import { workflowExecutor } from './workflowExecutor';
import { WorkflowDefinition } from '@sos/shared';

export interface ReplayOptions {
  skipCompleted?: boolean;
  modifyInputs?: Record<string, Record<string, unknown>>; // nodeId -> new input
  modifyOutputs?: Record<string, Record<string, unknown>>; // nodeId -> new output
  fromStepId?: string;
}

export class ReplayService {
  /**
   * Replay an execution from a specific step
   */
  async replayFromStep(
    executionId: string,
    fromStepId: string,
    options?: ReplayOptions
  ): Promise<string> {
    // Get original execution
    const [originalExecution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, executionId))
      .limit(1);

    if (!originalExecution) {
      throw new Error('Original execution not found');
    }

    // Get workflow definition
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, originalExecution.workflowId))
      .limit(1);

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Get all steps up to fromStepId
    const allSteps = await db
      .select()
      .from(executionSteps)
      .where(eq(executionSteps.executionId, executionId))
      .orderBy(asc(executionSteps.stepNumber));

    const fromStep = allSteps.find((s) => s.id === fromStepId);
    if (!fromStep) {
      throw new Error('Step not found');
    }

    const stepsToReplay = allSteps.filter(
      (s) => s.stepNumber <= fromStep.stepNumber
    );

    // Create new execution
    const [newExecution] = await db
      .insert(workflowExecutions)
      .values({
        workflowId: originalExecution.workflowId,
        status: 'running',
        input: originalExecution.input as any,
        metadata: {
          replay: {
            originalExecutionId: executionId,
            fromStepId,
            replayedAt: new Date(),
          },
        },
      })
      .returning();

    const newExecutionId = newExecution.id;

    // Replay steps up to fromStepId
    const results: Record<string, unknown> = {};
    for (const step of stepsToReplay) {
      // Skip if option is set and step is completed
      if (options?.skipCompleted && step.status === 'completed') {
        // Use stored output
        results[step.nodeId] = {
          nodeId: step.nodeId,
          success: true,
          output: step.output || {},
        };
        continue;
      }

      // Get node from workflow definition
      const definition = workflow.definition as WorkflowDefinition;
      const node = definition.nodes.find((n) => n.id === step.nodeId);
      if (!node) {
        continue;
      }

      // Prepare input (use modified input if provided)
      let input = (step.input as Record<string, unknown>) || {};
      if (options?.modifyInputs?.[step.nodeId]) {
        input = { ...input, ...options.modifyInputs[step.nodeId] };
      }

      // If we have stored output and skipCompleted, use it
      if (options?.skipCompleted && step.output) {
        results[step.nodeId] = {
          nodeId: step.nodeId,
          success: step.status === 'completed',
          output: options.modifyOutputs?.[step.nodeId] || step.output,
        };
        continue;
      }

      // Re-execute the node
      // Note: This is a simplified version - in production, you'd want to
      // properly reconstruct the execution graph and use workflowExecutor
      // For now, we'll create step records but not actually re-execute
      // Full re-execution would require more complex logic
    }

    // Continue execution from fromStepId
    // This would require calling workflowExecutor.executeWorkflow with
    // the current state and starting from the next step
    // For now, we'll mark it as a placeholder

    return newExecutionId;
  }

  /**
   * Replay entire execution
   */
  async replayExecution(
    executionId: string,
    options?: ReplayOptions
  ): Promise<string> {
    // Get original execution
    const [originalExecution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, executionId))
      .limit(1);

    if (!originalExecution) {
      throw new Error('Execution not found');
    }

    // Get workflow definition
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, originalExecution.workflowId))
      .limit(1);

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Create new execution
    const [newExecution] = await db
      .insert(workflowExecutions)
      .values({
        workflowId: originalExecution.workflowId,
        status: 'running',
        input: originalExecution.input as any,
        metadata: {
          replay: {
            originalExecutionId: executionId,
            replayedAt: new Date(),
          },
        },
      })
      .returning();

    // Execute workflow with same definition
    await workflowExecutor.executeWorkflow({
      workflowId: originalExecution.workflowId,
      definition: workflow.definition as WorkflowDefinition,
      input: (originalExecution.input as Record<string, unknown>) || {},
      executionId: newExecution.id,
    });

    return newExecution.id;
  }

  /**
   * Get execution steps
   */
  async getExecutionSteps(executionId: string) {
    return await db
      .select()
      .from(executionSteps)
      .where(eq(executionSteps.executionId, executionId))
      .orderBy(asc(executionSteps.stepNumber));
  }

  /**
   * Get specific step
   */
  async getStep(stepId: string) {
    const [step] = await db
      .select()
      .from(executionSteps)
      .where(eq(executionSteps.id, stepId))
      .limit(1);

    return step;
  }
}

export const replayService = new ReplayService();

