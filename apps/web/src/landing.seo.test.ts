import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// SEO guard for the landing page (KBR-121, docs/v0.20.0). The landing is the
// product's front door: these assert the invariants search engines and the
// Pages routing depend on — tags and structure, not copy — so the page can
// evolve without tripping this, but a regression that would de-index the site
// or break the root rewrite fails CI.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const landing = read('../landing.html');
const appShell = read('../index.html');
const redirects = read('../public/_redirects');
const robots = read('../public/robots.txt');
const sitemap = read('../public/sitemap.xml');

const CANONICAL = 'https://kbrelay.com/';

describe('landing.html SEO surface', () => {
  it('has a title, meta description, and canonical', () => {
    expect(landing).toMatch(/<title>[^<]*kbRelay[^<]*<\/title>/);
    const desc = /<meta name="description" content="([^"]+)"/.exec(landing);
    expect(desc, 'meta description present').toBeTruthy();
    expect(desc![1]!.length).toBeGreaterThan(50);
    expect(desc![1]!.length).toBeLessThan(170);
    expect(landing).toContain(`<link rel="canonical" href="${CANONICAL}"`);
    expect(landing).toContain('<meta name="robots" content="index,follow"');
  });

  it('carries valid JSON-LD structured data', () => {
    const blocks = [...landing.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    const types = blocks.map((m) => (JSON.parse(m[1]!) as { '@type': string })['@type']);
    expect(types).toContain('SoftwareApplication');
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
  });

  it('has exactly one h1 and real crawlable content', () => {
    expect(landing.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(landing).toMatch(/<h2[\s>]/);
    // The pitch must live in raw HTML, not be JS-rendered.
    expect(landing).toContain('API-first');
  });

  it('is self-contained: no raster images, external scripts, or stylesheets', () => {
    expect(landing).not.toMatch(/<img[\s>]/);
    expect(landing).not.toMatch(/<script[^>]*\ssrc=/);
    expect(landing).not.toMatch(/<link[^>]*rel="stylesheet"/);
  });

  it('funnels to the app', () => {
    expect(landing).toContain('href="/app?mode=register"');
    expect(landing).toContain('href="/app"');
  });
});

describe('routing + crawl files', () => {
  it('_redirects rewrites the root to the landing page', () => {
    // Extension-less target on purpose: `/landing.html` trips Pages'
    // pretty-URL normalization into a 308 redirect instead of a rewrite.
    expect(redirects).toMatch(/^\/ \/landing 200$/m);
  });

  it('robots.txt allows crawling and points at the sitemap', () => {
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toContain(`Sitemap: ${CANONICAL}sitemap.xml`);
  });

  it('sitemap lists the canonical root', () => {
    expect(sitemap).toContain(`<loc>${CANONICAL}</loc>`);
  });

  it('the app shell is noindexed (landing owns the SEO surface)', () => {
    expect(appShell).toContain('<meta name="robots" content="noindex"');
  });
});

// ── Pricing + legal pages (v0.23.0, KBR-135) ─────────────────

const terms = read('../terms.html');
const privacy = read('../privacy.html');

describe('pricing section', () => {
  it('exists with the three offerings and honest licensing language', () => {
    expect(landing).toContain('id="pricing"');
    expect(landing).toContain('$5');
    expect(landing).toContain('per person/month');
    expect(landing).toContain('$50 per person when billed annually');
    expect(landing).toContain('Managed Private');
    expect(landing).toContain('source-available');
    // ELv2 is not OSI open source — the marketing copy must never claim it.
    expect(landing.toLowerCase()).not.toContain('open source');
  });

  it('links the legal pages from the footer', () => {
    expect(landing).toContain('href="/terms"');
    expect(landing).toContain('href="/privacy"');
  });
});

describe('legal pages', () => {
  it.each([
    ['terms', terms, 'https://kbrelay.com/terms', 'Terms of Service'],
    ['privacy', privacy, 'https://kbrelay.com/privacy', 'Privacy Policy'],
  ])('%s: canonical, robots, title, entity', (_name, html, canonical, title) => {
    expect(html).toContain(`<link rel="canonical" href="${canonical}" />`);
    expect(html).toContain('<meta name="robots" content="index,follow" />');
    expect(html).toContain(title);
    expect(html).toContain('LaLa Solutions LLC');
    // Self-contained like the landing: no external scripts or stylesheets.
    expect(html).not.toMatch(/<script/);
    expect(html).not.toMatch(/<link[^>]*rel="stylesheet"/);
  });

  it('terms carry the refund + seat model commitments the UI advertises', () => {
    expect(terms).toContain('14 days');
    expect(terms).toContain('per human seat');
    expect(terms).toContain('Agent identities are free and unmetered');
    expect(terms).toContain('30-day full-featured trial');
    expect(terms).toContain('Square');
  });

  it('privacy names the actual processors and the no-training promise', () => {
    for (const vendor of ['Square', 'Cloudflare', 'Mailgun']) expect(privacy).toContain(vendor);
    expect(privacy).toContain('train machine-learning models');
  });

  it('sitemap lists the legal pages', () => {
    expect(sitemap).toContain('https://kbrelay.com/terms');
    expect(sitemap).toContain('https://kbrelay.com/privacy');
  });
});
