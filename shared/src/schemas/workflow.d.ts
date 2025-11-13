import { z } from 'zod';
export declare const WorkflowDefinitionSchema: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>;
        data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        selected: z.ZodOptional<z.ZodBoolean>;
        dragging: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        data: Record<string, unknown>;
        type: string;
        position: {
            x: number;
            y: number;
        };
        selected?: boolean | undefined;
        dragging?: boolean | undefined;
    }, {
        id: string;
        data: Record<string, unknown>;
        type: string;
        position: {
            x: number;
            y: number;
        };
        selected?: boolean | undefined;
        dragging?: boolean | undefined;
    }>, "many">;
    edges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodString;
        target: z.ZodString;
        sourceHandle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        targetHandle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type: z.ZodOptional<z.ZodString>;
        animated: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        source: string;
        target: string;
        type?: string | undefined;
        sourceHandle?: string | null | undefined;
        targetHandle?: string | null | undefined;
        animated?: boolean | undefined;
    }, {
        id: string;
        source: string;
        target: string;
        type?: string | undefined;
        sourceHandle?: string | null | undefined;
        targetHandle?: string | null | undefined;
        animated?: boolean | undefined;
    }>, "many">;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        position: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>;
        size: z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            width: number;
            height: number;
        }, {
            width: number;
            height: number;
        }>;
        style: z.ZodOptional<z.ZodObject<{
            backgroundColor: z.ZodOptional<z.ZodString>;
            borderColor: z.ZodOptional<z.ZodString>;
            borderWidth: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            backgroundColor?: string | undefined;
            borderColor?: string | undefined;
            borderWidth?: number | undefined;
        }, {
            backgroundColor?: string | undefined;
            borderColor?: string | undefined;
            borderWidth?: number | undefined;
        }>>;
        nodeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        position: {
            x: number;
            y: number;
        };
        label: string;
        size: {
            width: number;
            height: number;
        };
        nodeIds: string[];
        style?: {
            backgroundColor?: string | undefined;
            borderColor?: string | undefined;
            borderWidth?: number | undefined;
        } | undefined;
    }, {
        id: string;
        position: {
            x: number;
            y: number;
        };
        label: string;
        size: {
            width: number;
            height: number;
        };
        nodeIds: string[];
        style?: {
            backgroundColor?: string | undefined;
            borderColor?: string | undefined;
            borderWidth?: number | undefined;
        } | undefined;
    }>, "many">>;
    viewport: z.ZodOptional<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        zoom: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        zoom: number;
    }, {
        x: number;
        y: number;
        zoom: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    nodes: {
        id: string;
        data: Record<string, unknown>;
        type: string;
        position: {
            x: number;
            y: number;
        };
        selected?: boolean | undefined;
        dragging?: boolean | undefined;
    }[];
    edges: {
        id: string;
        source: string;
        target: string;
        type?: string | undefined;
        sourceHandle?: string | null | undefined;
        targetHandle?: string | null | undefined;
        animated?: boolean | undefined;
    }[];
    groups?: {
        id: string;
        position: {
            x: number;
            y: number;
        };
        label: string;
        size: {
            width: number;
            height: number;
        };
        nodeIds: string[];
        style?: {
            backgroundColor?: string | undefined;
            borderColor?: string | undefined;
            borderWidth?: number | undefined;
        } | undefined;
    }[] | undefined;
    viewport?: {
        x: number;
        y: number;
        zoom: number;
    } | undefined;
}, {
    nodes: {
        id: string;
        data: Record<string, unknown>;
        type: string;
        position: {
            x: number;
            y: number;
        };
        selected?: boolean | undefined;
        dragging?: boolean | undefined;
    }[];
    edges: {
        id: string;
        source: string;
        target: string;
        type?: string | undefined;
        sourceHandle?: string | null | undefined;
        targetHandle?: string | null | undefined;
        animated?: boolean | undefined;
    }[];
    groups?: {
        id: string;
        position: {
            x: number;
            y: number;
        };
        label: string;
        size: {
            width: number;
            height: number;
        };
        nodeIds: string[];
        style?: {
            backgroundColor?: string | undefined;
            borderColor?: string | undefined;
            borderWidth?: number | undefined;
        } | undefined;
    }[] | undefined;
    viewport?: {
        x: number;
        y: number;
        zoom: number;
    } | undefined;
}>;
export declare const WorkflowSettingsSchema: z.ZodObject<{
    timeout: z.ZodOptional<z.ZodNumber>;
    retry: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodBoolean;
        maxAttempts: z.ZodNumber;
        backoff: z.ZodEnum<["fixed", "exponential"]>;
        delay: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        backoff: "fixed" | "exponential";
        maxAttempts: number;
        delay: number;
    }, {
        enabled: boolean;
        backoff: "fixed" | "exponential";
        maxAttempts: number;
        delay: number;
    }>>;
    errorHandling: z.ZodOptional<z.ZodObject<{
        continueOnError: z.ZodBoolean;
        errorPath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        continueOnError: boolean;
        errorPath?: string | undefined;
    }, {
        continueOnError: boolean;
        errorPath?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    timeout?: number | undefined;
    retry?: {
        enabled: boolean;
        backoff: "fixed" | "exponential";
        maxAttempts: number;
        delay: number;
    } | undefined;
    errorHandling?: {
        continueOnError: boolean;
        errorPath?: string | undefined;
    } | undefined;
}, {
    timeout?: number | undefined;
    retry?: {
        enabled: boolean;
        backoff: "fixed" | "exponential";
        maxAttempts: number;
        delay: number;
    } | undefined;
    errorHandling?: {
        continueOnError: boolean;
        errorPath?: string | undefined;
    } | undefined;
}>;
export declare const CreateWorkflowSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    workspaceId: z.ZodString;
    definition: z.ZodObject<{
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>;
            data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            selected: z.ZodOptional<z.ZodBoolean>;
            dragging: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }, {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }>, "many">;
        edges: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            source: z.ZodString;
            target: z.ZodString;
            sourceHandle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            targetHandle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            type: z.ZodOptional<z.ZodString>;
            animated: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }, {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }>, "many">;
        groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>;
            size: z.ZodObject<{
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                width: number;
                height: number;
            }, {
                width: number;
                height: number;
            }>;
            style: z.ZodOptional<z.ZodObject<{
                backgroundColor: z.ZodOptional<z.ZodString>;
                borderColor: z.ZodOptional<z.ZodString>;
                borderWidth: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            }, {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            }>>;
            nodeIds: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }, {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }>, "many">>;
        viewport: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            zoom: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            zoom: number;
        }, {
            x: number;
            y: number;
            zoom: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        nodes: {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }[];
        edges: {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }[];
        groups?: {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }[] | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    }, {
        nodes: {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }[];
        edges: {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }[];
        groups?: {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }[] | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    }>;
    settings: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        retry: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            maxAttempts: z.ZodNumber;
            backoff: z.ZodEnum<["fixed", "exponential"]>;
            delay: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        }, {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        }>>;
        errorHandling: z.ZodOptional<z.ZodObject<{
            continueOnError: z.ZodBoolean;
            errorPath: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            continueOnError: boolean;
            errorPath?: string | undefined;
        }, {
            continueOnError: boolean;
            errorPath?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        timeout?: number | undefined;
        retry?: {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        } | undefined;
        errorHandling?: {
            continueOnError: boolean;
            errorPath?: string | undefined;
        } | undefined;
    }, {
        timeout?: number | undefined;
        retry?: {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        } | undefined;
        errorHandling?: {
            continueOnError: boolean;
            errorPath?: string | undefined;
        } | undefined;
    }>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    workspaceId: string;
    definition: {
        nodes: {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }[];
        edges: {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }[];
        groups?: {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }[] | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    };
    description?: string | undefined;
    settings?: {
        timeout?: number | undefined;
        retry?: {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        } | undefined;
        errorHandling?: {
            continueOnError: boolean;
            errorPath?: string | undefined;
        } | undefined;
    } | undefined;
    tags?: string[] | undefined;
}, {
    name: string;
    workspaceId: string;
    definition: {
        nodes: {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }[];
        edges: {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }[];
        groups?: {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }[] | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    };
    description?: string | undefined;
    settings?: {
        timeout?: number | undefined;
        retry?: {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        } | undefined;
        errorHandling?: {
            continueOnError: boolean;
            errorPath?: string | undefined;
        } | undefined;
    } | undefined;
    tags?: string[] | undefined;
}>;
export declare const UpdateWorkflowSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    definition: z.ZodOptional<z.ZodObject<{
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodString;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>;
            data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            selected: z.ZodOptional<z.ZodBoolean>;
            dragging: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }, {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }>, "many">;
        edges: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            source: z.ZodString;
            target: z.ZodString;
            sourceHandle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            targetHandle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            type: z.ZodOptional<z.ZodString>;
            animated: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }, {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }>, "many">;
        groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>;
            size: z.ZodObject<{
                width: z.ZodNumber;
                height: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                width: number;
                height: number;
            }, {
                width: number;
                height: number;
            }>;
            style: z.ZodOptional<z.ZodObject<{
                backgroundColor: z.ZodOptional<z.ZodString>;
                borderColor: z.ZodOptional<z.ZodString>;
                borderWidth: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            }, {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            }>>;
            nodeIds: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }, {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }>, "many">>;
        viewport: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
            zoom: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
            zoom: number;
        }, {
            x: number;
            y: number;
            zoom: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        nodes: {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }[];
        edges: {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }[];
        groups?: {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }[] | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    }, {
        nodes: {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }[];
        edges: {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }[];
        groups?: {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }[] | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    }>>;
    active: z.ZodOptional<z.ZodBoolean>;
    settings: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        retry: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            maxAttempts: z.ZodNumber;
            backoff: z.ZodEnum<["fixed", "exponential"]>;
            delay: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        }, {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        }>>;
        errorHandling: z.ZodOptional<z.ZodObject<{
            continueOnError: z.ZodBoolean;
            errorPath: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            continueOnError: boolean;
            errorPath?: string | undefined;
        }, {
            continueOnError: boolean;
            errorPath?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        timeout?: number | undefined;
        retry?: {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        } | undefined;
        errorHandling?: {
            continueOnError: boolean;
            errorPath?: string | undefined;
        } | undefined;
    }, {
        timeout?: number | undefined;
        retry?: {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        } | undefined;
        errorHandling?: {
            continueOnError: boolean;
            errorPath?: string | undefined;
        } | undefined;
    }>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    active?: boolean | undefined;
    description?: string | undefined;
    settings?: {
        timeout?: number | undefined;
        retry?: {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        } | undefined;
        errorHandling?: {
            continueOnError: boolean;
            errorPath?: string | undefined;
        } | undefined;
    } | undefined;
    definition?: {
        nodes: {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }[];
        edges: {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }[];
        groups?: {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }[] | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    } | undefined;
    tags?: string[] | undefined;
}, {
    name?: string | undefined;
    active?: boolean | undefined;
    description?: string | undefined;
    settings?: {
        timeout?: number | undefined;
        retry?: {
            enabled: boolean;
            backoff: "fixed" | "exponential";
            maxAttempts: number;
            delay: number;
        } | undefined;
        errorHandling?: {
            continueOnError: boolean;
            errorPath?: string | undefined;
        } | undefined;
    } | undefined;
    definition?: {
        nodes: {
            id: string;
            data: Record<string, unknown>;
            type: string;
            position: {
                x: number;
                y: number;
            };
            selected?: boolean | undefined;
            dragging?: boolean | undefined;
        }[];
        edges: {
            id: string;
            source: string;
            target: string;
            type?: string | undefined;
            sourceHandle?: string | null | undefined;
            targetHandle?: string | null | undefined;
            animated?: boolean | undefined;
        }[];
        groups?: {
            id: string;
            position: {
                x: number;
                y: number;
            };
            label: string;
            size: {
                width: number;
                height: number;
            };
            nodeIds: string[];
            style?: {
                backgroundColor?: string | undefined;
                borderColor?: string | undefined;
                borderWidth?: number | undefined;
            } | undefined;
        }[] | undefined;
        viewport?: {
            x: number;
            y: number;
            zoom: number;
        } | undefined;
    } | undefined;
    tags?: string[] | undefined;
}>;
//# sourceMappingURL=workflow.d.ts.map