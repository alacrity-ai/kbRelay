import type { Env } from '../env';

/**
 * Square client (v0.23.0, KBR-135) — raw fetch, no SDK, Workers-native.
 * Shape grounded in the proven landlord-contracts / legends-website clients:
 * env-switched base URL, pinned Square-Version, typed error extraction, and
 * WebCrypto webhook signature verification.
 *
 * Billing uses only Customers + Cards-on-file + Payments (app-driven recurring
 * billing — see docs/v0.23.0/0-BILLING_DESIGN.md §2 for why not Subscriptions).
 */

const SQUARE_API_VERSION = '2025-01-23';

export function billingEnabled(env: Env): boolean {
  return Boolean(env.SQUARE_ACCESS_TOKEN);
}

function apiBase(env: Env): string {
  return env.SQUARE_ENVIRONMENT === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

export class SquareError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function squareFetch<T>(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  if (!env.SQUARE_ACCESS_TOKEN) throw new SquareError(503, 'Billing is not configured');
  const res = await fetch(`${apiBase(env)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': SQUARE_API_VERSION,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    errors?: Array<{ category?: string; code?: string; detail?: string }>;
  } & T;
  if (!res.ok) {
    const first = json.errors?.[0];
    throw new SquareError(
      res.status,
      first?.detail ?? `Square ${method} ${path} failed (${res.status})`,
      first?.code ?? null,
    );
  }
  return json;
}

// ── Customers ─────────────────────────────────────────────────

export async function createCustomer(
  env: Env,
  args: { email: string; name: string; tenantId: string },
): Promise<string> {
  // Square caps idempotency keys at 45 chars — strip the `t_` prefix so the
  // deterministic per-tenant key fits (8 + 32 = 40). Caught by the live
  // sandbox E2E (billing.sandbox.test.ts).
  const json = await squareFetch<{ customer: { id: string } }>(env, 'POST', '/v2/customers', {
    idempotency_key: `kb-cust-${args.tenantId.replace(/^t_/, '')}`.slice(0, 45),
    email_address: args.email,
    company_name: args.name,
    reference_id: args.tenantId,
    note: `kbRelay Cloud tenant ${args.tenantId}`,
  });
  return json.customer.id;
}

// ── Cards on file ─────────────────────────────────────────────

export interface StoredCard {
  id: string;
  brand: string | null;
  last4: string | null;
  exp: string | null;
}

/** Store a Web Payments SDK token as a card on file ($0 verification auth). */
export async function createCard(
  env: Env,
  args: { customerId: string; sourceId: string; idempotencyKey: string },
): Promise<StoredCard> {
  const json = await squareFetch<{
    card: { id: string; card_brand?: string; last_4?: string; exp_month?: number; exp_year?: number };
  }>(env, 'POST', '/v2/cards', {
    idempotency_key: args.idempotencyKey,
    source_id: args.sourceId,
    card: { customer_id: args.customerId },
  });
  const c = json.card;
  const exp = c.exp_month && c.exp_year
    ? `${String(c.exp_month).padStart(2, '0')}/${c.exp_year}`
    : null;
  return { id: c.id, brand: c.card_brand ?? null, last4: c.last_4 ?? null, exp };
}

export async function disableCard(env: Env, cardId: string): Promise<void> {
  await squareFetch(env, 'POST', `/v2/cards/${encodeURIComponent(cardId)}/disable`);
}

// ── Payments ──────────────────────────────────────────────────

export interface ChargeResult {
  ok: boolean;
  paymentId: string | null;
  /** Square error detail on failure (declines land here, not as throws). */
  failureReason: string | null;
}

/**
 * Charge a stored card. Declines and card errors return `{ok:false}` so the
 * billing loop can transition to past_due without exception plumbing; only
 * config/transport errors throw.
 */
export async function chargeCard(
  env: Env,
  args: {
    customerId: string;
    cardId: string;
    amountCents: number;
    idempotencyKey: string;
    note: string;
  },
): Promise<ChargeResult> {
  try {
    const json = await squareFetch<{ payment: { id: string; status: string } }>(
      env,
      'POST',
      '/v2/payments',
      {
        idempotency_key: args.idempotencyKey,
        source_id: args.cardId,
        customer_id: args.customerId,
        amount_money: { amount: args.amountCents, currency: 'USD' },
        location_id: env.SQUARE_LOCATION_ID,
        autocomplete: true,
        note: args.note,
      },
    );
    const ok = json.payment.status === 'COMPLETED' || json.payment.status === 'APPROVED';
    return { ok, paymentId: json.payment.id, failureReason: ok ? null : json.payment.status };
  } catch (err) {
    if (err instanceof SquareError && err.status >= 400 && err.status < 500) {
      // Declines / bad card state come back as 4xx PAYMENT_METHOD_ERROR etc.
      return { ok: false, paymentId: null, failureReason: err.message };
    }
    throw err;
  }
}

// ── Webhook signature (HMAC-SHA256 over notificationUrl + rawBody) ──

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  notificationUrl: string,
  signatureKey: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signatureKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(notificationUrl + rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signatureHeader);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
