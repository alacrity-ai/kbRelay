# v0.20.0 — SEO Landing Page Design (KBR-121 / KBR-122)

The front door. `kbrelay.lalalimited.com/` today drops every visitor onto the
login form; crawlers see an empty `<div id="root">`. This doc specifies the
static landing page that replaces that: what it says, how it looks, every piece
of SVG art, and the SEO surface. The companion doc
(`2-IMPLEMENTATION_PLAN.md`, KBR-123) specifies how it ships without breaking
the SPA, emailed `/auth/*` deep links, or self-host.

---

## 1. Subject, audience, job

- **Subject:** kbRelay — a kanban board where humans and AI agents relay work
  to each other, with provenance for every move. The *relay* is the brand; it
  is literally the name.
- **Audience:** developers and technical leads already running coding/ops
  agents (Claude Code, Cursor, Windsurf, Cline) who need the missing
  coordination layer between themselves and their agents. They evaluate tools
  fast, respect craft, and distrust marketing fluff.
- **The page's single job:** make a stranger understand *"kanban built for
  humans + agents, every move signed"* within one screen, then move them to
  the existing register/sign-in flow (`/app`). Brief by requirement: a few
  images and lines, not a scrolling brochure.

## 2. Design direction

### 2.1 A sibling of the product (not a separate brand)

The landing steals the app's design system verbatim — same rule as
`beautiful-pdf-packets.md` §4 ("the packet must look like a sibling of the
product it's selling"). All tokens are ported from `apps/web/src/styles.css`:

| Token | Value | Landing use |
|---|---|---|
| `--bg` | `#0b1220` | page background |
| `--bg-2` | `#0f172a` | alternate band background |
| `--surface` / `--surface-2` | `#111c30` / `#1a2740` | cards, terminal block, SVG node fills |
| `--border` / `--border-strong` | `#26344d` / `#354765` | 1px hairlines everywhere |
| `--text` / `--text-dim` / `--muted` | `#e6edf7` / `#aab6c9` / `#7d8ba3` | copy hierarchy |
| `--accent` | `#3b82f6` | **the human color** + primary CTA |
| `--ok` | `#10b981` | **the agent color** |
| radii | 6 / 9 / 12 / 16 / pill | same components idioms |
| shadows | `--shadow-1/2/3` | card elevation |
| motion | 150ms `cubic-bezier(0.2,0.6,0.2,1)` | hover transitions |
| body bg flourish | `radial-gradient(1200px 600px at 20% -10%, #14203a 0%, transparent 60%)` | identical on the landing |

Lane colors already in the product (KBR board defaults) become the page's
structural palette: Ready `#7c3aed`, In Progress `#2563eb`, In Review
`#d97706`, Done `#16a34a`.

**Self-critique against the generic-default trap:** "near-black background +
single bright accent" is a known AI-design cliché — but here the dark navy +
blue *is the product's actual shipped design system*, so it's fidelity, not
default. The distinctiveness budget is spent elsewhere (see 2.2–2.4): the
two-actor color braid, the board-lane page structure, and the hand-authored
provenance artwork. What we deliberately do **not** do: stock dashboard
screenshots, gradient-mesh hero blobs, emoji, mermaid, numbered 01/02/03
markers with no sequence meaning, or a webfont fetched from a CDN.

### 2.2 The two-actor rule (the accent discipline)

Everything on the page that means **human** is blue (`#3b82f6`); everything
that means **agent** is emerald (`#10b981`). Both are existing app tokens
(`--accent`, `--ok`). Every illustration argues exactly one thing — *work
relays between the two and both leave signatures* — expressed as blue and
green touching the same card. No other saturated colors appear in art except
the lane-name eyebrows (2.3). This is the packet SOP's "red is reserved for
the ONE thing the diagram argues," adapted: the page's one argument is the
blue↔green exchange.

### 2.3 Structure is information: the page is a card crossing the board

Sections carry small mono eyebrow chips named after the product's real lanes,
in the product's real lane colors — because the visitor's journey down the
page *is* a card moving across a board:

| Section | Eyebrow chip | Lane color |
|---|---|---|
| Hero | `READY` | `#7c3aed` |
| Features (the three claims) | `IN PROGRESS` | `#2563eb` |
| Connect your agent + run anywhere | `IN REVIEW` | `#d97706` |
| Final CTA | `DONE` | `#16a34a` |

This is a true sequence (evaluate → decide → act), so the device encodes
meaning rather than decorating. Chips are quiet: 11px mono uppercase,
letter-spacing .12em, 1px hairline border, pill radius, lane-colored text on
`--surface` — the same visual weight as the app's column headers.

### 2.4 Typography

No webfont fetch (perf + reproducibility; the app itself ships no `@font-face`
— its `'Inter', system-ui, …` stack resolves to system fonts for most
visitors, and the landing must match what the app actually renders).

- **Display + body:** `'Inter', system-ui, -apple-system, 'Segoe UI', Roboto,
  sans-serif` — identical stack to the app.
- **Utility/mono (the personality carrier):** `ui-monospace, 'SFMono-Regular',
  'Cascadia Code', Menlo, Consolas, monospace` — for eyebrow chips, ticket
  keys (`KBR-121`), provenance stamps in art captions, the timeline lines, and
  the MCP command block. Mono is the product's vernacular (API-first, agents,
  ticket keys); it does the differentiating work a display face would
  otherwise do.

Scale (desktop → mobile via clamp):

| Element | Spec |
|---|---|
| H1 | `clamp(2.1rem, 5.2vw, 3.4rem)`, weight 800, letter-spacing −0.025em, line-height 1.08 |
| Hero subline | `clamp(1rem, 1.6vw, 1.2rem)`, `--text-dim`, max-width 34rem, line-height 1.6 |
| Section H2 | `clamp(1.4rem, 2.6vw, 1.9rem)`, weight 750, letter-spacing −0.015em |
| Card H3 | 1.05rem, weight 650 |
| Body | 0.95rem, `--text-dim`, line-height 1.6 |
| Eyebrow chip / keys / stamps | 0.6875rem mono, uppercase, tracking .12em |
| Footer | 0.8125rem, `--muted` |

One typographic accent inside the H1: the word **and** (in "humans **and**
agents") set as a small mono, pill-bordered inline chip in the blue→green
gradient — the only gradient on the page, a 2-character signature, not a hero
wash.

## 3. Page architecture + full copy

Brief is a requirement: ~4 viewports desktop, every line placed deliberately.
All copy final below (build verbatim; wordsmithing during build must not
change meaning).

```
┌────────────────────────────────────────────────────────────┐
│ topbar: [logo] kbRelay          API docs · GitHub · Sign in │
│                                            [Get started]   │
├────────────────────────────────────────────────────────────┤
│ HERO  (READY chip)                                         │
│  H1 + subline + CTAs            ┌──────────────────────┐   │
│  [Get started free] [Sign in]   │  relay-board SVG     │   │
│  "no credit card · self-host"   │  (signature artwork) │   │
│                                 └──────────────────────┘   │
├────────────────────────────────────────────────────────────┤
│ FEATURES (IN PROGRESS chip) — 3 cards, each with vignette  │
│  [signed moves]  [agents are teammates]  [nothing ships    │
│                                           without you]     │
├────────────────────────────────────────────────────────────┤
│ CONNECT (IN REVIEW chip)                                   │
│  terminal block: claude mcp add …   + client list          │
│  run-anywhere row: cloud · npx · docker                    │
├────────────────────────────────────────────────────────────┤
│ CTA (DONE chip)  headline + [Get started free] [Sign in]   │
├────────────────────────────────────────────────────────────┤
│ footer: © LaLa Solutions · ELv2 · docs · github · npm · ✉  │
└────────────────────────────────────────────────────────────┘
```

### 3.1 Topbar

Sticky, `--bg` at 80% opacity + backdrop-blur, hairline bottom border.
`BrandMark` SVG (ported verbatim from `BrandMark.tsx`, static ids) + wordmark
"kbRelay" (weight 700). Right: `API docs` (→ `/docs`), `GitHub`
(→ `https://github.com/alacrity-ai/kbRelay`), `Sign in` (→ `/app`), primary
button `Get started` (→ `/app?mode=register`). On mobile the text links
collapse; logo + `Sign in` + `Get started` remain.

### 3.2 Hero (`READY`)

- **H1:** `Kanban built for humans [and] agents`
  (`[and]` = the gradient mono chip, § 2.4).
- **Subline:** `kbRelay is a lightweight, API-first board where you file work
  for an AI agent, the agent works it and hands it back for review — and
  every move records who did it, human or agent.`
- **CTAs:** primary `Get started free` (→ `/app?mode=register`), secondary
  `Sign in` (→ `/app`). Under them, one mono microline:
  `no credit card · open API · self-host with one command`.
- **Right: the signature artwork** — the relay board (art spec A, §4.1).
- Progressive enhancement: if a session cookie authenticates
  (`GET /api/v1/auth/me` → 200), the primary CTA swaps to `Open your board`
  (→ `/app`). Pure enhancement; the static CTAs are the no-JS truth.

### 3.3 Features (`IN PROGRESS`) — h2 + three cards

**H2:** `An honest ledger of who did what` — with one short lead-in line:
`Trello-style boards, plus the three things agent work actually needs.`

1. **Every move is signed.** Cards carry who created and last touched them —
   and whether they were a human or an agent. The timeline is append-only:
   the spec lives on the card, the history can't be rewritten.
   *(vignette: art spec B)*
2. **Agents are teammates, not scripts.** Agents get their own identities and
   API keys, owned by a human. Their work is attributed to them — assign them
   cards, @-mention them, read their handoffs.
   *(vignette: art spec C)*
3. **Nothing finishes without you.** Agents pick up from Ready, work in
   In Progress, and hand back to In Review with evidence. Only a human moves
   a card to Done.
   *(vignette: art spec D)*

### 3.4 Connect your agent (`IN REVIEW`)

**H2:** `Your agent connects in one command`

Terminal block (mono, `--surface` on `--bg-2` band, traffic-light dots in
`--surface-3` — no red/amber/green, that would violate the two-actor rule):

```
claude mcp add kbrelay --scope user \
  --env KBRELAY_BASE_URL=https://kbrelay.lalalimited.com \
  --env KBRELAY_API_KEY=<your agent's key> \
  -- npx -y @alacrity-ai/kbrelaymcp
```

Line under it: `20 board tools over MCP — works with Claude Code, Cursor,
Windsurf, Cline, and anything that speaks MCP. Or drive the HTTP API
directly.` (link `HTTP API` → `/docs`).

**Run-anywhere row** (three quiet key/value tiles, mono keys):
- `cloud` — Sign up and start on kbrelay.lalalimited.com.
- `npx` — `npx @alacrity-ai/kbrelay` boots API + board + SQLite locally.
- `docker` — One container for production self-hosting. Same database format.

### 3.5 Final CTA (`DONE`)

**H2:** `Put the first card on the board` — line:
`Create a workspace in under a minute. Free — self-hosting is one command if
you'd rather keep it yours.` CTAs repeat (primary `Get started free`,
secondary `Sign in`).

### 3.6 Footer

`kbRelay by LaLa Solutions` · `Elastic License 2.0` (→ GitHub LICENSE.md) ·
`API docs` (→ `/docs`) · `GitHub` · `npm: kbrelaymcp` (→ the npm package) ·
`leif@lalalimited.com`. One line, wraps on mobile. No sitemap-style link farm.

## 4. Hand-authored SVG art plan

Rules for all art (from `beautiful-pdf-packets.md` §5, adapted to screen):

- **Inline SVG, hand-authored** — geometry planned on a fixed viewBox before
  writing paths. No mermaid, no emoji, no raster.
- **Semantic class conventions**, one `<style>` per SVG, classes suffixed per
  diagram to avoid document-global collisions (`.bxA`, `.flA`, `.bxB`, …):
  `.lane` (column container), `.bx` (card/node), `.tt`/`.ts` (title/small
  text), `.fl` (flow path), `.stamp` (provenance chip), `.hu`/`.ag`
  (human-blue / agent-green emphasis).
- **Flow paths are cubic Béziers** (`C`), never elbows; shared arrowhead
  `<marker>` (`refX=9`, `orient=auto-start-reverse`), one blue and one green
  variant, ids suffixed per diagram.
- **Text budget:** ~0.55×font-size per character; shorten copy, never shrink
  below 10px effective; `svg text { font-family: <mono stack> }` for stamps
  and keys, sans for titles.
- **Accessibility:** every SVG gets `role="img"` + `<title>` (+ `aria-label`);
  decorative internals `aria-hidden`.
- **The one argument per artwork** is stated in this spec; anything not
  serving it gets cut.

### 4.1 (A) The relay board — hero signature

- **Argument:** a card travels human → agent → back to human, and every move
  is signed.
- **viewBox:** `0 0 760 540`. Three lanes at x = 24 / 272 / 520, each 216
  wide, full height, `--surface` fill, hairline stroke, r=12. Lane headers at
  y=48: mono `READY` (violet), `IN PROGRESS` (blue), `IN REVIEW` (amber) with
  count pills, mirroring the real app's column header idiom.
- **Cards:** ghost cards (empty skeleton bars, `--surface-2`) fill lanes at
  low opacity for depth; the **hero card** (`KBR-88 · Ship the release notes`)
  appears in all three lanes, but solid in In Review (its current home) and
  as dashed-outline "past positions" in Ready and In Progress.
- **The relay path:** one continuous Bézier from the Ready card → In Progress
  card → In Review card. First segment **blue** (human filed it), second
  segment **green** (agent moved it), meeting at a small braid/handshake knot
  where they overlap at the In Progress card. Dash-animated flow
  (`stroke-dashoffset` keyframes, 6s linear infinite) — disabled under
  `prefers-reduced-motion`, and the static dashes still read as direction.
- **Provenance stamps** (mono, 11px) pinned beneath each card position:
  `filed by @leif · human` (blue dot), `picked up by @claude · agent` (green
  dot), `handed back · evidence attached` (green dot, amber lane). These
  stamps are the argument made literal.
- **Bottom strip:** a 3-line timeline excerpt in mono 10.5px, `--muted`, like
  the app's timeline: `@leif created KBR-88`, `@claude moved Ready →
  In Progress`, `@claude handed off — In Review`, each with its actor-colored
  dot. Confirms "append-only log" without a word of marketing.
- Mobile: the SVG scales to container width (min effective text ≈ 9px at
  360px — acceptable because stamps are ornamental duplicates of body copy;
  `<title>` carries the meaning for AT).

### 4.2 (B) Signed move — provenance vignette

- **Argument:** one move, two signatures.
- **viewBox:** `0 0 320 180`. A single card (`--surface-2`, r=9) center-left
  with key `KBR-42` and two skeleton text bars. Below it two stamp chips:
  blue `created · @leif · human`, green `updated · @claude · agent`. A short
  green Bézier nudges the card toward a lane edge on the right (motion
  implied, 8px offset). Nothing else.

### 4.3 (C) Agent identity card — vignette

- **Argument:** the agent is a first-class user.
- **viewBox:** `0 0 320 180`. An ID-card shape (r=12) with a green square
  avatar bearing a terminal-caret glyph (`>`), name `@claude`, a green pill
  `agent`, mono line `key ····-··7f`, and a small blue line `owner: @leif` —
  ownership is the human tether, so it stays blue.

### 4.4 (D) The handback loop — vignette

- **Argument:** the loop closes at a human gate.
- **viewBox:** `0 0 320 180`. Three small nodes left→right: `Ready`,
  `In Progress`, `In Review` (lane-colored 3px top borders). Green Bézier
  arrows Ready→In Progress→In Review (the agent's leg); one **blue** return
  Bézier arcing over the top from In Review back past Ready labeled
  `review · @leif` with a small gate tick (⊸ rendered as two strokes, not a
  glyph). `Done` appears as a dashed node to the right of the gate — reachable
  only through the blue arc.

### 4.5 BrandMark

Ported verbatim from `BrandMark.tsx` (blue-gradient rounded square + white
kanban tiles), static gradient id (`bmk-g`) since there's no React `useId`.
Used in topbar (28px) and footer (20px).

## 5. Interaction & motion

- Hover: cards lift 1px + border-strong; buttons exactly like the app
  (`translateY(1px)` active, `--ring` focus-visible outline).
- The hero relay path's dash-flow is the **only** ambient animation. One
  orchestrated entrance on load: hero copy and artwork fade/translate-in once
  (180ms, staggered ~80ms). Everything else is static.
- `@media (prefers-reduced-motion: reduce)`: all animation and transitions
  off (`animation: none; transition: none`), dashes remain static.
- The session-check enhancement (`/api/v1/auth/me`) runs after load,
  silently; failure = do nothing. No layout shift (CTA text swap only).
- No scroll-jacking, no parallax, no cookie banner (no third-party anything).

## 6. SEO spec

### 6.1 Head

- `<title>`: `kbRelay — Kanban where humans and AI agents relay work`
- Meta description (154 chars):
  `kbRelay is a lightweight, API-first kanban board for human–AI teamwork:
  file work for agents, review their handoffs, and see who did what — every
  move signed.`
- `<link rel="canonical" href="https://kbrelay.lalalimited.com/">`
- `<meta name="robots" content="index,follow">` (explicit, because the app
  shell gets `noindex`).
- OG/Twitter: mirror the existing `index.html` set (og-image.jpg 1200×630,
  `summary_large_image`), `og:url` = canonical.
- Favicons + theme-color: reuse the existing set verbatim.

### 6.2 Structured data (JSON-LD, one script per type)

- `SoftwareApplication`: name kbRelay, `applicationCategory:
  BusinessApplication`, `operatingSystem: Web`, url, description, `offers:
  { @type: Offer, price: 0, priceCurrency: USD }`, publisher → Organization.
- `Organization`: LaLa Solutions, url, logo (`apple-touch-icon.png`),
  `sameAs`: GitHub org URL, npm package URL.
- `WebSite`: name + url + inLanguage.

### 6.3 Content hygiene

- Exactly one `h1`; sections use `h2` (feature cards `h3`); semantic
  landmarks `header/main/section/footer`; nav is a `<nav>`.
- All meaningful copy in raw HTML (zero JS-rendered content).
- Internal links: `/app`, `/app?mode=register`, `/docs`. External:
  GitHub, npm — `rel="noopener"`.
- Keywords carried naturally in copy (kanban board, AI agents, MCP server,
  human-in-the-loop review, provenance, self-host) — no keyword-stuffing
  block, no hidden text.

### 6.4 Crawl surface

- `robots.txt`: `User-agent: * / Allow: /`, `Disallow: /app`, `Sitemap:
  https://kbrelay.lalalimited.com/sitemap.xml`.
- `sitemap.xml`: the single canonical URL (grow later if more marketing pages
  appear).
- SPA shell `index.html` gains `<meta name="robots" content="noindex">` — the
  login wall must never outrank the landing, and self-host instances
  shouldn't be indexed at all. Its OG tags stay (nice link unfurls for shared
  app URLs).

## 7. Responsive + performance budget

- Breakpoints: single-column ≤ 760px (hero art moves under copy; feature
  cards stack; terminal block font drops to 12px with horizontal scroll
  inside its own container — the page never scrolls horizontally). Verified
  at 360 / 768 / 1440.
- Budget: **≤ 100 KB raw HTML+CSS+SVG total, zero external requests** beyond
  same-origin favicon/og assets already cached by the domain. No webfonts, no
  analytics, no framework. Expected ~45–60 KB raw (≈ 12–16 KB gzipped).
- Lighthouse targets: Performance ≥ 95, SEO = 100, a11y ≥ 95 on the live URL.

## 8. What the build must not do

- No emoji anywhere (product rule). No mermaid. No raster screenshots (real
  board data would leak; ghost-card SVGs carry the idea instead).
- No new colors outside the token table + lane colors.
- No copy changes that alter §3's meaning without a note on KBR-124.
- No third-party requests of any kind.

## 9. Definition of done (design ticket)

- This doc attached to KBR-122 and committed at
  `docs/v0.20.0/1-LANDING_PAGE_DESIGN.md`.
- KBR-124 (build) and KBR-125 (wiring) can execute from §3–§7 without further
  design decisions.
