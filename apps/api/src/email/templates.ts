/**
 * Transactional email templates — inline HTML + plain-text, styled to match
 * kbRelay's dark, mono-accented aesthetic. Every interpolated value passes
 * through escapeHtml. Grounded in houseops (`email/templates.ts`).
 *
 * v0.10.0 flows: welcome (registration) and password reset. The invite
 * template lands with Item 2.
 */

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    const m: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return m[ch] ?? ch;
  });
}

const SHELL_HTML = (title: string, body: string): string => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:24px;background:#0f1115;color:#e6e8ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#171a21;border:1px solid #2a2f3a;border-radius:12px;padding:32px;">
      <p style="margin:0 0 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8a93a6;">kbRelay</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:650;letter-spacing:-0.01em;color:#f4f6fa;">${escapeHtml(title)}</h1>
      ${body}
      <hr style="border:0;border-top:1px solid #2a2f3a;margin:28px 0 14px;" />
      <p style="margin:0;font-size:12px;color:#6c7486;">Sent by kbRelay · kbrelay.com</p>
    </div>
  </body>
</html>`;

function ctaButton(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#4f7cff;color:#fff;padding:12px 20px;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;">${escapeHtml(label)}</a></p>`;
}

export interface WelcomeArgs {
  name: string;
  tenantName: string;
  signInUrl: string;
}

export function welcomeEmail(args: WelcomeArgs): { subject: string; text: string; html: string } {
  const subject = 'Welcome to kbRelay';
  const text = `Welcome, ${args.name}.

Your workspace "${args.tenantName}" is ready. kbRelay is a kanban board where you and your agents relay work to each other.

Sign in: ${args.signInUrl}

— kbRelay`;
  const html = SHELL_HTML(
    `Welcome, ${escapeHtml(args.name)}`,
    `<p style="margin:0 0 12px;line-height:1.6;">Your workspace <strong>${escapeHtml(args.tenantName)}</strong> is ready.</p>
     <p style="margin:0 0 12px;line-height:1.6;">kbRelay is a kanban board where you and your agents relay work to each other.</p>
     ${ctaButton(args.signInUrl, 'Open your board')}`,
  );
  return { subject, text, html };
}

export interface InviteArgs {
  inviterName: string;
  tenantName: string;
  role: string;
  acceptUrl: string;
}

export function inviteEmail(args: InviteArgs): { subject: string; text: string; html: string } {
  const subject = `${args.inviterName} invited you to ${args.tenantName} on kbRelay`;
  const text = `${args.inviterName} invited you to join "${args.tenantName}" on kbRelay as ${args.role}.

Accept the invite: ${args.acceptUrl}

The link expires in 7 days.`;
  const html = SHELL_HTML(
    `Invitation to ${escapeHtml(args.tenantName)}`,
    `<p style="margin:0 0 12px;line-height:1.6;"><strong>${escapeHtml(args.inviterName)}</strong> invited you to join <strong>${escapeHtml(args.tenantName)}</strong> on kbRelay as <em>${escapeHtml(args.role)}</em>.</p>
     ${ctaButton(args.acceptUrl, 'Accept invite')}
     <p style="margin:0 0 12px;line-height:1.6;color:#8a93a6;">The link expires in 7 days.</p>`,
  );
  return { subject, text, html };
}

// ── Billing (v0.23.0, KBR-135) ────────────────────────────────

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function shortDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function receiptEmail(args: {
  tenantName: string;
  seats: number;
  amountCents: number;
  periodEnd: number;
  billingUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `kbRelay Cloud receipt — ${money(args.amountCents)}`;
  const line = `${args.seats} seat${args.seats === 1 ? '' : 's'} · ${money(args.amountCents)} · paid through ${shortDate(args.periodEnd)}`;
  const text = `Thanks! Your kbRelay Cloud subscription for "${args.tenantName}" is paid.

${line}

Manage billing: ${args.billingUrl}`;
  const html = SHELL_HTML(
    'Payment received',
    `<p style="margin:0 0 12px;line-height:1.6;">Your kbRelay Cloud subscription for <strong>${escapeHtml(args.tenantName)}</strong> is paid.</p>
     <p style="margin:0 0 12px;line-height:1.6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(line)}</p>
     ${ctaButton(args.billingUrl, 'Manage billing')}`,
  );
  return { subject, text, html };
}

export function chargeFailedEmail(args: {
  tenantName: string;
  graceDays: number;
  billingUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = 'kbRelay Cloud — payment failed';
  const text = `We couldn't charge the card on file for "${args.tenantName}".

We'll retry over the next few days. Please update your card within ${args.graceDays} days to keep the workspace active — after that it becomes read-only until payment succeeds. Your data is never deleted for a failed payment.

Update card: ${args.billingUrl}`;
  const html = SHELL_HTML(
    'Payment failed',
    `<p style="margin:0 0 12px;line-height:1.6;">We couldn't charge the card on file for <strong>${escapeHtml(args.tenantName)}</strong>.</p>
     <p style="margin:0 0 12px;line-height:1.6;">We'll retry over the next few days. Please update your card within <strong>${args.graceDays} days</strong> to keep the workspace active — after that it becomes read-only until payment succeeds. Your data is never deleted for a failed payment.</p>
     ${ctaButton(args.billingUrl, 'Update card')}`,
  );
  return { subject, text, html };
}

export function accountLockedEmail(args: {
  tenantName: string;
  billingUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = 'kbRelay Cloud — workspace is now read-only';
  const text = `Payment for "${args.tenantName}" is overdue, so the workspace is now read-only.

Everything is still there and readable — update your card to pick up right where you left off. Your data is yours: reads and export remain available.

Fix billing: ${args.billingUrl}`;
  const html = SHELL_HTML(
    'Workspace is read-only',
    `<p style="margin:0 0 12px;line-height:1.6;">Payment for <strong>${escapeHtml(args.tenantName)}</strong> is overdue, so the workspace is now read-only.</p>
     <p style="margin:0 0 12px;line-height:1.6;">Everything is still there and readable — update your card to pick up right where you left off. Your data is yours: reads and export remain available.</p>
     ${ctaButton(args.billingUrl, 'Fix billing')}`,
  );
  return { subject, text, html };
}

export function trialReminderEmail(args: {
  tenantName: string;
  daysLeft: number;
  billingUrl: string;
}): { subject: string; text: string; html: string } {
  const when = args.daysLeft <= 1 ? 'tomorrow' : `in ${args.daysLeft} days`;
  const subject = `Your kbRelay Cloud trial ends ${when}`;
  const text = `The trial for "${args.tenantName}" ends ${when}.

Subscribe for $5 per person per month ($50/year) to keep going — agents are always free. Or self-host kbRelay for free, forever.

Subscribe: ${args.billingUrl}`;
  const html = SHELL_HTML(
    `Trial ends ${when}`,
    `<p style="margin:0 0 12px;line-height:1.6;">The trial for <strong>${escapeHtml(args.tenantName)}</strong> ends ${escapeHtml(when)}.</p>
     <p style="margin:0 0 12px;line-height:1.6;">Subscribe for <strong>$5 per person per month</strong> ($50/year) to keep going — agents are always free. Or self-host kbRelay for free, forever.</p>
     ${ctaButton(args.billingUrl, 'Subscribe')}`,
  );
  return { subject, text, html };
}

export function trialExpiredEmail(args: {
  tenantName: string;
  billingUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = 'Your kbRelay Cloud trial has ended';
  const text = `The trial for "${args.tenantName}" has ended, and the workspace is now read-only.

Nothing was deleted: subscribe any time to pick up exactly where you left off, or read and export your data whenever you like.

Subscribe: ${args.billingUrl}`;
  const html = SHELL_HTML(
    'Trial ended',
    `<p style="margin:0 0 12px;line-height:1.6;">The trial for <strong>${escapeHtml(args.tenantName)}</strong> has ended, and the workspace is now read-only.</p>
     <p style="margin:0 0 12px;line-height:1.6;">Nothing was deleted: subscribe any time to pick up exactly where you left off, or read and export your data whenever you like.</p>
     ${ctaButton(args.billingUrl, 'Subscribe')}`,
  );
  return { subject, text, html };
}

export interface PasswordResetArgs {
  resetUrl: string;
}

export function passwordResetEmail(args: PasswordResetArgs): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = 'Reset your kbRelay password';
  const text = `A password reset was requested for this email.

Open this link within the next hour to choose a new password:

  ${args.resetUrl}

If you didn't ask for this, you can ignore this message.`;
  const html = SHELL_HTML(
    'Reset your password',
    `<p style="margin:0 0 12px;line-height:1.6;">A password reset was requested for this email. Click below within the next hour to choose a new one.</p>
     ${ctaButton(args.resetUrl, 'Reset password')}
     <p style="margin:0 0 12px;line-height:1.6;color:#8a93a6;">If you didn't ask for this, you can ignore this message.</p>`,
  );
  return { subject, text, html };
}
