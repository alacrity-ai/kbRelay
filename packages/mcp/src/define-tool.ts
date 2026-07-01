import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { KbRelayClient } from './client.js';

/** A tool as declared: a zod input schema + a handler that calls the client. */
export interface ToolDef<S extends ZodTypeAny> {
  name: string;
  /** ≤200 chars; teaches the model kbRelay's conventions. */
  description: string;
  inputSchema: S;
  handler: (args: ZodInfer<S>, client: KbRelayClient) => Promise<unknown>;
}

/** A registered tool: JSON Schema for ListTools + a validated runner for CallTool. */
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: unknown, client: KbRelayClient) => Promise<unknown>;
}

export function defineTool<S extends ZodTypeAny>(def: ToolDef<S>): Tool {
  const jsonSchema = zodToJsonSchema(def.inputSchema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
  delete jsonSchema.$schema;

  return {
    name: def.name,
    description: def.description,
    inputSchema: jsonSchema,
    // async so a zod validation error surfaces as a rejected promise.
    run: async (args, client) => def.handler(def.inputSchema.parse(args ?? {}), client),
  };
}
