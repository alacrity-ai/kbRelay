# v0.20.0 — Landing Page Implementation Plan (KBR-121 / KBR-123)

How the landing page specified in `1-LANDING_PAGE_DESIGN.md` ships to
`kbrelay.lalalimited.com/` without breaking the SPA, emailed `/auth/*` deep
links, or the two self-host paths. Executes as KBR-124 (page) + KBR-125
(wiring) + KBR-126 (ship).

---

## 1. Routing architecture

### 1.1 The constraint set

1. **Prod serving:** the Pages project `kbrelay` owns every path on
   `kbrelay.lalalimited.com` except the Worker's wildcard routes `/api/*` and
   `/docs*` (a Pages custom domain shadows non-wildcard Worker routes —
   see the KBR-109 note in `apps/api/wrangler.toml`). The landing must
   therefore be a **static Pages asset**, not a Worker route.
2. **Deep links:** password-reset and invite emails link to
   `/auth/reset/<token>` / `/auth/accept-invite/<token>`; `App.tsx` parses
   `location.pathname`. Today these resolve via Pages' SPA fallback
   (any non-asset path → `index.html`). Links already in inboxes must keep
   working forever.
3. **Self-host:** both self-host paths (`npx @alacrity-ai/kbrelay`, Docker)
   serve `apps/web/dist` through `apps/api/src/runtime/node/index.ts`, which
   maps `/` → `index.html` and falls back extension-less paths →
   `index.html`. A self-host instance is a private workspace — it must boot
   into the **board**, not a marketing page.

### 1.2 Decision: `index.html` stays the SPA; the landing is a rewrite

- `apps/web/index.html` **remains the SPA shell** — untouched semantics.
  Self-host (`/` → `index.html`) and every existing deep link and bookmark
  keep working with **zero** changes to the Node server, the Docker image, or
  the npx launcher.
- `apps/web/landing.html` is a **second Vite input** (true MPA build) —
  `dist/landing.html` ships beside the SPA.
- `apps/web/public/_redirects` (Cloudflare Pages redirect file, copied into
  `dist/` by Vite) carries one **200 rewrite**:

  ```
  / /landing.html 200
  ```

  On Pages, redirect rules are evaluated **before** static-asset serving, so
  `/` serves the landing's content (URL unchanged, status 200 — correct for
  SEO). Every other path behaves exactly as today: real assets serve
  directly; non-asset paths (`/app`, `/auth/reset/<t>`) hit the SPA fallback
  → `index.html`.
- **The app's canonical URL becomes `/app`** (any non-asset path works; we
  standardize on `/app`). Landing CTAs: `Get started` → `/app?mode=register`,
  `Sign in` → `/app`.
- Cloudflare-only by construction: self-host never reads `_redirects`
  (`dist/landing.html` is reachable there but linked from nowhere — harmless;
  it advertises the product's own cloud, acceptable).

**Why not the inverse** (landing = `index.html`, SPA = `app.html`)? It would
put the marketing page at `/` on every self-host instance and require
changing the Node server's fallback + the selfhost/Docker packaging, i.e.
three more moving parts and a breaking self-host behavior change, for zero
SEO gain.

### 1.3 Fallback if the root rewrite misbehaves on Pages

Verified on the **dev** Pages project before prod (§5). If `/ /landing.html
200` doesn't rewrite (Pages redirect engine edge case around the root asset):

- Plan B: swap filenames (landing becomes `index.html`, SPA becomes
  `app.html`) + `_redirects` rules `/app /app.html 200` and `/auth/*
  /app.html 200` + change the Node server fallback (`index.html` →
  `app.html`) and re-verify self-host. This touches self-host, so it
  re-enters review before any prod deploy (per KBR-126).

### 1.4 Indexing policy

- `landing.html`: full SEO head, canonical `https://kbrelay.lalalimited.com/`
  (the rewrite makes `/` its canonical home; `/landing.html` being directly
  reachable is deduplicated by the canonical tag).
- `index.html` (SPA shell): `<meta name="robots" content="noindex">` — the
  login wall must not compete with the landing, and self-host instances
  shouldn't be indexed. OG tags stay (link unfurls for shared app URLs).

## 2. File-change list (exact)

| File | Change |
|---|---|
| `apps/web/landing.html` | **new** — the complete landing page: inline CSS + inline hand-authored SVGs + SEO head + one tiny inline enhancement script (session-aware CTA), per the design doc §3–§7 |
| `apps/web/vite.config.ts` | add `build.rollupOptions.input = { main: 'index.html', landing: 'landing.html' }` (via `fileURLToPath` paths) |
| `apps/web/public/_redirects` | **new** — `/ /landing.html 200` |
| `apps/web/public/robots.txt` | **new** — allow all, `Disallow: /app`, `Sitemap:` pointer |
| `apps/web/public/sitemap.xml` | **new** — single `<url>` for the canonical root |
| `apps/web/index.html` | add `<meta name="robots" content="noindex" />` |
| `apps/web/src/pages/AuthShell.tsx` | initial mode honors `?mode=register` (precedence: reset token > invite token > `?mode=register` > `sign-in`); reset/invite `history.replaceState(null, '', '/')` → `'/app'` (post-rewrite, a refresh on `/` would land on the marketing page mid-auth-flow; `/app` resolves to the SPA on both Pages and self-host) |
| `apps/web/src/landing.seo.test.ts` | **new** guard test (vitest): landing.html has `<title>`, meta description, canonical, `index,follow`, ≥3 JSON-LD blocks that `JSON.parse`, exactly one `<h1>`, no `<img>`/external `http(s)` asset requests, CTAs to `/app`; `_redirects` contains the root rewrite; robots.txt references sitemap; sitemap contains the canonical URL; index.html contains `noindex` |

Docs committed in the same change: `docs/v0.20.0/1-LANDING_PAGE_DESIGN.md`,
`docs/v0.20.0/2-IMPLEMENTATION_PLAN.md`.

Out of scope (deliberately): API/Worker changes, migrations, MCP, selfhost
package, Docker image, README (can gain a "landing" line later).

## 3. Safety arguments

- **Emailed `/auth/*` links:** unchanged mechanics — non-asset path → SPA
  fallback → `index.html` → `App.tsx` `parseDeepToken()` reads
  `location.pathname`. The only touched code path is the *post-success*
  `replaceState` target (`/` → `/app`), which strictly improves behavior
  after the rewrite exists.
- **Self-host (npx + Docker):** zero touched files in
  `apps/api/src/runtime/node`, `packages/selfhost`,
  `infrastructure/docker`. `dist` gains `landing.html`, `_redirects`,
  `robots.txt`, `sitemap.xml` — all inert static files under the Node
  server (`_redirects` is a Pages-only convention). `/` still serves
  `index.html` (the board).
- **The board SPA:** no route logic added; `?mode=register` is read once at
  AuthShell mount and ignored when authenticated (App renders BoardApp
  without consulting it).
- **No secrets:** the page is fully static; the enhancement script calls the
  same-origin cookie endpoint `GET /api/v1/auth/me` and reads only HTTP
  status.

## 4. Test plan

1. **Existing gates** (all must stay green): `make typecheck`, `make lint`,
   `make test` (shared + api + mcp + web incl. the new guard test),
   `make build`, `make check-boundaries`.
2. **Local functional verify** (`make dev` stack or `vite preview`):
   - `/landing.html` renders; all internal anchors resolve.
   - `/` in dev still serves the SPA (the rewrite is Pages-infra; expected
     local difference — documented, not a defect).
   - `/app?mode=register` opens the Create-workspace tab; `/app` opens
     Sign-in; an authenticated session still lands on the board.
   - `/auth/reset/dummytoken` still opens the reset form.
3. **Visual verify** (Playwright + system Chrome, per
   `frontend-ui-verification` discipline): screenshots of the landing at
   360×800, 768×1024, 1440×900; check console for errors; eyeball pass
   against the design doc (typography, art, spacing, lane-chip rhythm).
4. **Post-deploy verify** — §5.

## 5. Rollout (KBR-126)

1. **Commit + push to `main`** as `leifktaylor` (per Leif's explicit
   instruction to land on the primary branch): conventional message
   `feat(web): SEO landing page at / — the front door (KBR-121)`, DCO
   sign-off + co-author trailer; secret-scan the diff first.
2. **Dev deploy:** `make deploy-web-dev` (Cloudflare creds injected via
   `agentsecrets`; wrangler vendored in the repo). Verify on
   `https://dev.kbrelay.lalalimited.com`:
   - `curl /` → 200 + landing markup (the rewrite works on real Pages infra);
   - `curl /app` → SPA shell; `curl /auth/reset/x` → SPA shell;
   - `/robots.txt`, `/sitemap.xml` → 200;
   - `/api/health` → ok (Worker routes untouched);
   - browser: sign-in on dev still works; landing renders.
   If the rewrite fails → stop, report on KBR-126, execute §1.3 Plan B
   (re-enters review before prod).
3. **Prod deploy:** `make deploy-web-prod` (web only — no API deploy, no
   migrations in this change).
4. **Prod verification:**
   - `curl -s https://kbrelay.lalalimited.com/` → 200, landing content
     (h1 + JSON-LD present in raw HTML);
   - `/app` → SPA (login); `/auth/reset/dummy` → SPA; `/robots.txt` +
     `/sitemap.xml` → 200; `/docs` → Scalar; `/api/health` → ok;
   - Playwright screenshots (desktop + mobile) of the live landing;
   - sign-in smoke test on prod;
   - evidence attached to KBR-126, handoff to @leif.
5. **Rollback:** `git revert` + `make deploy-web-prod` restores the previous
   root behavior in one deploy (the SPA shell never moved, so rollback is
   asset-only). D1 untouched.

## 6. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Pages won't 200-rewrite `/` | low | dev-first deploy; Plan B (§1.3) |
| Logged-in users bookmarked `/` and now see marketing | certain, minor | session-aware CTA swaps to "Open your board"; one click. `/app` is the new bookmark |
| `/landing.html` duplicate-content | low | canonical tag → `/` |
| Guard test rots as copy evolves | low | asserts invariants (tags/structure), not copy strings |
| SPA asset hashing collides with landing assets | none | landing inlines everything; no shared chunks |

## 7. Definition of done

- KBR-124 + KBR-125 merged to `main` in one coherent commit with this doc +
  the design doc.
- All §4 gates green locally; §5 dev + prod verifications recorded on
  KBR-126 with screenshots.
- Landing live at the prod root; SPA, deep links, docs, API all verified
  untouched; Leif notified for evaluation (epic closes on his say-so).
