import type { BillingConfig, BillingInvoice } from '@kbrelay/shared';
import { subscribeInput, updateCardInput, changePlanInput } from '@kbrelay/shared';
import type { RouteContext } from '../router';
import { jsonResponse, errorResponse, HttpError } from '../http';
import { parseJson } from '../validate';
import { requireAdmin } from '../auth/access';
import { getAuthUser } from '../db/repos/auth';
import { listInvoices, findInvoiceBySquarePayment, markInvoice } from '../db/repos/billing';
import { billingEnabled, verifyWebhookSignature } from '../services/square';
import {
  getBillingSummary,
  subscribe,
  updateCard,
  changePlan,
  cancelSubscription,
  resumeSubscription,
} from '../services/billing';

/**
 * Billing routes (v0.23.0, KBR-135). Admin-gated in-handler like /team; all
 * no-op cleanly when billing is disabled (self-host) — GET reports
 * `enabled:false`, mutations 409 — so the SPA and MCP degrade gracefully.
 */

function requireBilling(ctx: RouteContext): void {
  if (!billingEnabled(ctx.env)) throw new HttpError(409, 'Billing is not enabled on this deployment');
}

// ── GET /api/v1/billing ───────────────────────────────────────
/** Member-readable so every human sees trial/lock banners; the stored-card
 *  details are admin-only. Mutations + invoices stay requireAdmin. */
export async function handleGetBilling(ctx: RouteContext): Promise<Response> {
  const { auth } = ctx;
  if (!auth) return errorResponse(401, 'Authentication required', ctx.cors);
  const summary = await getBillingSummary(ctx.env, auth.tenantId);
  if (auth.role !== 'admin') summary.card = null;
  return jsonResponse(200, summary, ctx.cors);
}

// ── GET /api/v1/billing/config ────────────────────────────────
/** Web Payments SDK bootstrap. Member-visible (no card data involved). */
export function handleGetBillingConfig(ctx: RouteContext): Response {
  if (!ctx.auth) return errorResponse(401, 'Authentication required', ctx.cors);
  const { env } = ctx;
  const enabled = billingEnabled(env);
  const body: BillingConfig = {
    enabled,
    appId: enabled ? (env.SQUARE_APP_ID ?? null) : null,
    locationId: enabled ? (env.SQUARE_LOCATION_ID ?? null) : null,
    environment: enabled
      ? (env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox')
      : null,
  };
  return jsonResponse(200, body, ctx.cors);
}

// ── POST /api/v1/billing/subscribe ────────────────────────────
export async function handleSubscribe(ctx: RouteContext): Promise<Response> {
  requireBilling(ctx);
  const auth = requireAdmin(ctx.auth);
  const input = await parseJson(ctx.request, subscribeInput);

  const user = await getAuthUser(ctx.env, auth.tenantId, auth.userId);
  if (!user?.email) throw new HttpError(409, 'Your account needs an email address to subscribe');

  await subscribe(ctx.env, {
    tenantId: auth.tenantId,
    plan: input.plan,
    sourceId: input.sourceId,
    adminEmail: user.email,
    adminName: user.name,
  });
  return jsonResponse(200, await getBillingSummary(ctx.env, auth.tenantId), ctx.cors);
}

// ── POST /api/v1/billing/card ─────────────────────────────────
export async function handleUpdateCard(ctx: RouteContext): Promise<Response> {
  requireBilling(ctx);
  const auth = requireAdmin(ctx.auth);
  const input = await parseJson(ctx.request, updateCardInput);
  const user = await getAuthUser(ctx.env, auth.tenantId, auth.userId);
  const result = await updateCard(ctx.env, {
    tenantId: auth.tenantId,
    sourceId: input.sourceId,
    adminEmail: user?.email ?? '',
  });
  const summary = await getBillingSummary(ctx.env, auth.tenantId);
  return jsonResponse(200, { ...summary, retry: result }, ctx.cors);
}

// ── POST /api/v1/billing/plan ─────────────────────────────────
export async function handleChangePlan(ctx: RouteContext): Promise<Response> {
  requireBilling(ctx);
  const auth = requireAdmin(ctx.auth);
  const input = await parseJson(ctx.request, changePlanInput);
  await changePlan(ctx.env, auth.tenantId, input.plan);
  return jsonResponse(200, await getBillingSummary(ctx.env, auth.tenantId), ctx.cors);
}

// ── POST /api/v1/billing/cancel · /resume ────────────────────
export async function handleCancelSubscription(ctx: RouteContext): Promise<Response> {
  requireBilling(ctx);
  const auth = requireAdmin(ctx.auth);
  await cancelSubscription(ctx.env, auth.tenantId);
  return jsonResponse(200, await getBillingSummary(ctx.env, auth.tenantId), ctx.cors);
}

export async function handleResumeSubscription(ctx: RouteContext): Promise<Response> {
  requireBilling(ctx);
  const auth = requireAdmin(ctx.auth);
  await resumeSubscription(ctx.env, auth.tenantId);
  return jsonResponse(200, await getBillingSummary(ctx.env, auth.tenantId), ctx.cors);
}

// ── GET /api/v1/billing/invoices ──────────────────────────────
export async function handleListBillingInvoices(ctx: RouteContext): Promise<Response> {
  const auth = requireAdmin(ctx.auth);
  const rows = await listInvoices(ctx.env, auth.tenantId);
  const invoices: BillingInvoice[] = rows.map((r) => ({
    id: r.id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    seats: r.seats,
    unitPriceCents: r.unit_price_cents,
    amountCents: r.amount_cents,
    status: r.status,
    createdAt: r.created_at,
  }));
  return jsonResponse(200, { invoices }, ctx.cors);
}

// ── POST /api/square/webhook (public, HMAC-verified) ──────────
/**
 * Square push. v1 consumes `payment.updated` to sync refunds onto invoices
 * (`refund.created`-adjacent flows all surface here). Unknown events ack 200
 * so Square doesn't retry-storm. Signature = HMAC-SHA256(url + rawBody).
 */
export async function handleSquareWebhook(ctx: RouteContext): Promise<Response> {
  const { env, cors, request, waitUntil } = ctx;
  const key = env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!billingEnabled(env) || !key) return errorResponse(503, 'Billing webhooks not configured', cors);

  const rawBody = await request.text();
  const notificationUrl = `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/square/webhook`;
  const ok = await verifyWebhookSignature(
    rawBody,
    request.headers.get('x-square-hmacsha256-signature'),
    notificationUrl,
    key,
  );
  if (!ok) return errorResponse(401, 'Invalid signature', cors);

  let event: {
    type?: string;
    data?: { object?: { payment?: { id?: string; status?: string; refunded_money?: { amount?: number } } } };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return errorResponse(400, 'Invalid JSON', cors);
  }

  if (event.type === 'payment.updated') {
    const payment = event.data?.object?.payment;
    if (payment?.id) {
      waitUntil(syncPaymentStatus(ctx, payment));
    }
  }
  return jsonResponse(200, { ok: true }, cors);
}

async function syncPaymentStatus(
  ctx: RouteContext,
  payment: { id?: string; status?: string; refunded_money?: { amount?: number } },
): Promise<void> {
  try {
    if (!payment.id) return;
    const invoice = await findInvoiceBySquarePayment(ctx.env, payment.id);
    if (!invoice) return; // not one of ours (or first-charge race — the charge path already recorded it)
    if ((payment.refunded_money?.amount ?? 0) > 0 && invoice.status !== 'refunded') {
      await markInvoice(ctx.env, invoice.id, 'refunded');
    }
  } catch (err) {
    console.error('[billing] webhook sync failed:', err);
  }
}
