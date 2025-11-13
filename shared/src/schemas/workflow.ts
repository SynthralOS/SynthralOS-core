import { z } from 'zod';

export const WorkflowDefinitionSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
      data: z.record(z.unknown()),
      selected: z.boolean().optional(),
      dragging: z.boolean().optional(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().nullable().optional(),
      targetHandle: z.string().nullable().optional(),
      type: z.string().optional(),
      animated: z.boolean().optional(),
    })
  ),
  groups: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        position: z.object({
          x: z.number(),
          y: z.number(),
        }),
        size: z.object({
          width: z.number(),
          height: z.number(),
        }),
        style: z
          .object({
            backgroundColor: z.string().optional(),
            borderColor: z.string().optional(),
            borderWidth: z.number().optional(),
          })
          .optional(),
        nodeIds: z.array(z.string()),
      })
    )
    .optional(),
  viewport: z
    .object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    })
    .optional(),
});

export const WorkflowSettingsSchema = z.object({
  timeout: z.number().positive().optional(),
  retry: z
    .object({
      enabled: z.boolean(),
      maxAttempts: z.number().int().positive(),
      backoff: z.enum(['fixed', 'exponential']),
      delay: z.number().positive(),
    })
    .optional(),
  errorHandling: z
    .object({
      continueOnError: z.boolean(),
      errorPath: z.string().optional(),
    })
    .optional(),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  workspaceId: z.string(),
  definition: WorkflowDefinitionSchema,
  settings: WorkflowSettingsSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  definition: WorkflowDefinitionSchema.optional(),
  active: z.boolean().optional(),
  settings: WorkflowSettingsSchema.optional(),
  tags: z.array(z.string()).optional(),
});

