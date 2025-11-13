"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWorkflowSchema = exports.CreateWorkflowSchema = exports.WorkflowSettingsSchema = exports.WorkflowDefinitionSchema = void 0;
const zod_1 = require("zod");
exports.WorkflowDefinitionSchema = zod_1.z.object({
    nodes: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        type: zod_1.z.string(),
        position: zod_1.z.object({
            x: zod_1.z.number(),
            y: zod_1.z.number(),
        }),
        data: zod_1.z.record(zod_1.z.unknown()),
        selected: zod_1.z.boolean().optional(),
        dragging: zod_1.z.boolean().optional(),
    })),
    edges: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        source: zod_1.z.string(),
        target: zod_1.z.string(),
        sourceHandle: zod_1.z.string().nullable().optional(),
        targetHandle: zod_1.z.string().nullable().optional(),
        type: zod_1.z.string().optional(),
        animated: zod_1.z.boolean().optional(),
    })),
    groups: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string(),
        label: zod_1.z.string(),
        position: zod_1.z.object({
            x: zod_1.z.number(),
            y: zod_1.z.number(),
        }),
        size: zod_1.z.object({
            width: zod_1.z.number(),
            height: zod_1.z.number(),
        }),
        style: zod_1.z
            .object({
            backgroundColor: zod_1.z.string().optional(),
            borderColor: zod_1.z.string().optional(),
            borderWidth: zod_1.z.number().optional(),
        })
            .optional(),
        nodeIds: zod_1.z.array(zod_1.z.string()),
    }))
        .optional(),
    viewport: zod_1.z
        .object({
        x: zod_1.z.number(),
        y: zod_1.z.number(),
        zoom: zod_1.z.number(),
    })
        .optional(),
});
exports.WorkflowSettingsSchema = zod_1.z.object({
    timeout: zod_1.z.number().positive().optional(),
    retry: zod_1.z
        .object({
        enabled: zod_1.z.boolean(),
        maxAttempts: zod_1.z.number().int().positive(),
        backoff: zod_1.z.enum(['fixed', 'exponential']),
        delay: zod_1.z.number().positive(),
    })
        .optional(),
    errorHandling: zod_1.z
        .object({
        continueOnError: zod_1.z.boolean(),
        errorPath: zod_1.z.string().optional(),
    })
        .optional(),
});
exports.CreateWorkflowSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().optional(),
    workspaceId: zod_1.z.string(),
    definition: exports.WorkflowDefinitionSchema,
    settings: exports.WorkflowSettingsSchema.optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.UpdateWorkflowSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255).optional(),
    description: zod_1.z.string().optional(),
    definition: exports.WorkflowDefinitionSchema.optional(),
    active: zod_1.z.boolean().optional(),
    settings: exports.WorkflowSettingsSchema.optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
//# sourceMappingURL=workflow.js.map