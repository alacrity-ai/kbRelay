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

const CANONICAL = 'https://kbrelay.lalalimited.com/';

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
    expect(redirects).toMatch(/^\/ \/landing\.html 200$/m);
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
