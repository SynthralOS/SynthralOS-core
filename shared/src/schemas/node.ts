import { z } from 'zod';

export const NodeConfigPropertySchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string().optional(),
  default: z.unknown().optional(),
  enum: z.array(z.unknown()).optional(),
  format: z.string().optional(),
});

export const NodeConfigSchema = z.object({
  type: z.literal('object'),
  properties: z.record(NodeConfigPropertySchema),
  required: z.array(z.string()).optional(),
});

