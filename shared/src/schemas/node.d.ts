import { z } from 'zod';
export declare const NodeConfigPropertySchema: z.ZodObject<{
    type: z.ZodEnum<["string", "number", "boolean", "object", "array"]>;
    description: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodUnknown>;
    enum: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
    format: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "string" | "number" | "boolean" | "object" | "array";
    default?: unknown;
    description?: string | undefined;
    enum?: unknown[] | undefined;
    format?: string | undefined;
}, {
    type: "string" | "number" | "boolean" | "object" | "array";
    default?: unknown;
    description?: string | undefined;
    enum?: unknown[] | undefined;
    format?: string | undefined;
}>;
export declare const NodeConfigSchema: z.ZodObject<{
    type: z.ZodLiteral<"object">;
    properties: z.ZodRecord<z.ZodString, z.ZodObject<{
        type: z.ZodEnum<["string", "number", "boolean", "object", "array"]>;
        description: z.ZodOptional<z.ZodString>;
        default: z.ZodOptional<z.ZodUnknown>;
        enum: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
        format: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "string" | "number" | "boolean" | "object" | "array";
        default?: unknown;
        description?: string | undefined;
        enum?: unknown[] | undefined;
        format?: string | undefined;
    }, {
        type: "string" | "number" | "boolean" | "object" | "array";
        default?: unknown;
        description?: string | undefined;
        enum?: unknown[] | undefined;
        format?: string | undefined;
    }>>;
    required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "object";
    properties: Record<string, {
        type: "string" | "number" | "boolean" | "object" | "array";
        default?: unknown;
        description?: string | undefined;
        enum?: unknown[] | undefined;
        format?: string | undefined;
    }>;
    required?: string[] | undefined;
}, {
    type: "object";
    properties: Record<string, {
        type: "string" | "number" | "boolean" | "object" | "array";
        default?: unknown;
        description?: string | undefined;
        enum?: unknown[] | undefined;
        format?: string | undefined;
    }>;
    required?: string[] | undefined;
}>;
//# sourceMappingURL=node.d.ts.map