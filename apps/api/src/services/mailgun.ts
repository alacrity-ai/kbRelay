import type { Env } from '../env';

/**
 * Mailgun outbound client. Workers-compatible (no SDK), one fetch per send.
 * Grounded in houseops (`apps/api/src/services/mailgun.ts`).
 *
 * When MAILGUN_API_KEY or MAILGUN_DOMAIN is unset (local / self-host), the
 * client SHORT-CIRCUITS: logs the would-be message and returns { ok: true }.
 * So the local loop and self-hosting need no inbox; prod (secrets set) sends.
 */

export interface MailgunMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  from?: string;
  tags?: string[];
}

export interface MailgunResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendMailgun(env: Env, msg: MailgunMessage): Promise<MailgunResult> {
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.log(`[mailgun] short-circuit (unconfigured) to=${msg.to} subject=${msg.subject}`);
    return { ok: true };
  }
  const baseUrl = (env.MAILGUN_BASE_URL ?? 'https://api.mailgun.net').replace(/\/$/, '');
  const url = `${baseUrl}/v3/${env.MAILGUN_DOMAIN}/messages`;
  const auth = btoa(`api:${env.MAILGUN_API_KEY}`);
  const from = msg.from ?? env.MAILGUN_FROM ?? `kbRelay <noreply@${env.MAILGUN_DOMAIN}>`;

  const form = new FormData();
  form.append('from', from);
  form.append('to', msg.to);
  form.append('subject', msg.subject);
  form.append('text', msg.text);
  form.append('html', msg.html);
  for (const tag of msg.tags ?? []) form.append('o:tag', tag);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Basic ${auth}` },
      body: form,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({ message: 'Unknown error' }))) as {
        message?: string;
      };
      return { ok: false, error: body.message ?? `Mailgun returned ${res.status}` };
    }
    const body = (await res.json()) as { id?: string };
    return { ok: true, providerMessageId: body.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
