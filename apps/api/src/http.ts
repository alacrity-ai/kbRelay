/**
 * HTTP helpers shared by every route: CORS, JSON responses, error shape.
 * Mirrors the landlord-contracts pattern so the two Workers read alike.
 */

export function getCorsHeaders(
  request: Request,
  allowedOrigins: string,
): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowlist = allowedOrigins.split(',').map((s) => s.trim());
  const allow = allowlist.includes(origin) ? origin : allowlist[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,authorization',
    Vary: 'Origin',
  };
}

export function jsonResponse(
  status: number,
  body: unknown,
  corsHeaders: Record<string, string>,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders,
      ...extra,
    },
  });
}

export function errorResponse(
  status: number,
  error: string,
  corsHeaders: Record<string, string>,
  details?: Record<string, string>,
): Response {
  return jsonResponse(status, { error, ...(details ? { details } : {}) }, corsHeaders);
}

/**
 * Thrown by route/repo code to signal a specific HTTP status. The top-level
 * handler catches it and renders a clean error body, so handlers can
 * `throw new HttpError(404, 'Card not found')` instead of threading
 * Response objects around.
 */
export class HttpError extends Error {
  status: number;
  details?: Record<string, string>;
  constructor(status: number, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
