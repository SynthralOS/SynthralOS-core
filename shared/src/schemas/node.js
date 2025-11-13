"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeConfigSchema = exports.NodeConfigPropertySchema = void 0;
const zod_1 = require("zod");
exports.NodeConfigPropertySchema = zod_1.z.object({
    type: zod_1.z.enum(['string', 'number', 'boolean', 'object', 'array']),
    description: zod_1.z.string().optional(),
    default: zod_1.z.unknown().optional(),
    enum: zod_1.z.array(zod_1.z.unknown()).optional(),
    format: zod_1.z.string().optional(),
});
exports.NodeConfigSchema = zod_1.z.object({
    type: zod_1.z.literal('object'),
    properties: zod_1.z.record(exports.NodeConfigPropertySchema),
    required: zod_1.z.array(zod_1.z.string()).optional(),
});
//# sourceMappingURL=node.js.map