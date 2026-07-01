import type { z } from 'zod';
import { HttpError } from './http';

/**
 * Read a JSON body and validate it against a zod schema. Throws a 400
 * HttpError (rendered by the dispatcher) with per-field messages on
 * malformed JSON or validation failure.
 */
export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const details: Record<string, string> = {};
    for (const issue of result.error.issues) {
      details[issue.path.join('.') || '_'] = issue.message;
    }
    throw new HttpError(400, 'Validation failed', details);
  }
  return result.data;
}
