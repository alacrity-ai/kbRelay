/**
 * HMAC-SHA256 verification of an inbound kbRelay webhook (KBR-17). The kbRelay
 * Worker signs the raw body with the subscription secret and sends
 * `X-KBRelay-Signature: sha256=<hex>`. We recompute and compare in constant
 * time. Web Crypto only — runs under Node or Bun.
 */

async function hmacHex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time hex-string compare (avoids leaking match position via timing). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True iff `header` is a valid signature of `rawBody` under `secret`.
 * Accepts the `sha256=` prefix or a bare hex digest. A missing header → false.
 */
export async function verifySignature(
  secret: string,
  rawBody: string,
  header: string | null | undefined,
): Promise<boolean> {
  if (!header) return false;
  const provided = header.startsWith('sha256=') ? header.slice('sha256='.length) : header;
  const expected = await hmacHex(secret, rawBody);
  return timingSafeEqual(expected.toLowerCase(), provided.toLowerCase());
}
