# kbRelay — v0.4.0 Design: native markdown

**Date:** 2026-07-01
**Status:** design + implementation plan
**Predecessors:** v0.1.0 (UX), v0.2.0 (colors/refresh/navbar), v0.3.0 (timeline)
**Live:** https://kbrelay.lalalimited.com
**Scope:** `apps/web` only. **No** API, schema, migration, or shared changes.

---

## 1. Problem

Card text is stored and shown as plain text. Agents and humans naturally write in
markdown — headings, bullet lists, `code`, links, tables — and it renders as raw
`#`, `-`, and backticks. The v0.3.0 handoffs are the sharpest example: an evidence
list or a code ref reads better rendered. Cards should **support markdown out of
the box**.

## 2. The ask (verbatim intent)

- Descriptions, acceptance criteria, **etc.** just support markdown natively.
- **Edit mode = raw text** (a plain textarea, exactly as today).
- **View mode = rendered markdown.**
- **No toolbar**, no WYSIWYG, no formatting buttons — just render the syntax.

## 3. Approach

Render markdown → React elements at view time. **No storage change** — the same
text is saved; only the *view* changes. Editing still shows the raw source.

**Library:** [`react-markdown`](https://github.com/remarkjs/react-markdown) +
[`remark-gfm`](https://github.com/remarkjs/remark-gfm) +
[`remark-breaks`](https://github.com/remarkjs/remark-breaks).

- `react-markdown` renders to React elements (**no `dangerouslySetInnerHTML`**) and
  **does not render raw HTML** by default — so embedded `<script>`/`<img onerror>`
  can't execute. That's the safe default and we keep it (no `rehype-raw`).
- `remark-gfm` adds GitHub-flavored extensions: tables, strikethrough, task lists,
  literal URLs → links.
- `remark-breaks` maps a single newline → `<br>`, preserving the line-by-line feel
  cards had under the old `white-space: pre-wrap` rendering (so nobody has to learn
  "two trailing spaces"). It's the one deliberate deviation from strict CommonMark,
  chosen for note-taking ergonomics.
- Links render with `target="_blank" rel="noopener noreferrer"`.

**Why not a lighter/custom parser:** hand-rolling markdown is a security and
correctness trap; `react-markdown` is the standard, sanitized-by-default choice.
The added bundle (~30–40 KB gzip) is acceptable for first-class card text.

## 4. Where it applies

A single reusable `<Markdown>` component, used in **view mode only**:

| Surface | Today | v0.4.0 |
|---|---|---|
| Card **description** (view) | plain, `pre-wrap` | **rendered markdown** |
| Card **acceptance criteria** (view) | plain, `pre-wrap` | **rendered markdown** |
| Timeline **note / handoff body** | plain, `pre-wrap` | **rendered markdown** |
| Card **title** | plain | **unchanged** (titles are short, single-line) |
| Handoff `summary` + slot lists (evidence/verify/spunOff) | plain | **unchanged** (short tokens; kept literal) |
| Any **edit** textarea | raw | **unchanged** (raw source) |
| Empty states ("No description.") | plain | **unchanged** |

## 5. Implementation

1. `apps/web/package.json` — add `react-markdown`, `remark-gfm`, `remark-breaks`.
2. `apps/web/src/components/Markdown.tsx` — new: wraps `ReactMarkdown` with the two
   plugins, a safe `a` renderer, inside a `.markdown` container.
3. `CardModal.tsx` (view mode) — render description + acceptance criteria through
   `<Markdown>` (empty states stay plain).
4. `Timeline.tsx` — render note/handoff `body` through `<Markdown>`.
5. `styles.css` — `.markdown` block styles: headings, paragraphs, `ul/ol/li`, task
   lists, inline `code`, `pre` code blocks, `blockquote`, `a`, `table`, `hr`,
   `strong/em`, tuned for the dark theme; drop `pre-wrap` where markdown now owns
   layout. Keep the bordered "box" look for description/AC.

## 6. Non-goals

- No toolbar / WYSIWYG / formatting buttons.
- No raw-HTML passthrough (kept off for safety).
- No markdown in titles, no live edit-preview split, no image upload.
- No API/schema/timeline changes — this is purely a rendering upgrade.

## 7. Verify & deploy

- `make typecheck && make lint && make build` clean.
- Manual check (desktop + ~390px): headings/lists/code/links/tables/task-lists
  render in a card's description, AC, and a timeline handoff; editing still shows
  raw markdown; long/edge content doesn't overflow.
- **Web-only deploy:** `make deploy-web-prod` (no `db-migrate`, no API deploy).
- `docs/v0.4.0/RELEASE_NOTES.md`.

## 8. Risk / rollback

Frontend-only, render-time. Worst case is a rendering glitch, not data loss (the
stored text is untouched and still valid as plain text). Rollback = redeploy the
previous Pages build.
