# kbRelay — v0.4.0 Release Notes

**Date:** 2026-07-01
**Type:** UX release (web-only)
**Live:** https://kbrelay.lalalimited.com

Card text now supports **markdown natively**. No API, schema, or migration change.

## What changed
- **View mode renders markdown; edit mode stays raw text.** No toolbar, no WYSIWYG
  — you just type markdown and it renders when viewing.
- Applied to: card **description**, **acceptance criteria**, and timeline
  **note / handoff bodies**. Titles, handoff summary/slot lists, edit textareas,
  and empty states are unchanged.
- **GitHub-flavored markdown**: headings, bullet/numbered lists, task lists
  (`- [ ]`/`- [x]`), **bold**/*italic*/~~strike~~, inline `code`, fenced code
  blocks, blockquotes, tables, `---` rules, and autolinked/`[text](url)` links
  (links open in a new tab, `rel="noopener noreferrer"`).
- A single newline becomes a line break (soft breaks on), preserving the
  line-by-line feel card text had before.

## How it's built
- `react-markdown` + `remark-gfm` + `remark-breaks`, wrapped in a small
  `Markdown` component; themed via a `.markdown` stylesheet block.
- **Safe by default:** `react-markdown` renders to React elements (no
  `dangerouslySetInnerHTML`) and does **not** emit raw HTML (no `rehype-raw`), so
  HTML/scripts embedded in card text can't execute.
- Bundle grew ~46 KB gzip (95 → 142 KB) for the markdown stack — expected for
  first-class card text.

## Verification
- `typecheck` ✓ · `lint` ✓ · `build` ✓ (33 unit tests unaffected).
- Render test (SSR) confirmed headings, soft breaks, bold, task-list checkboxes,
  inline code, code blocks, tables, blockquotes, strikethrough, and links all
  render from GFM source.
- **Deploy:** `make deploy-web-prod` (Pages only — no D1/Worker change). Live
  bundle `index-CATVbvvH.js` / `index-mEEYsORV.css`; API health ok.
- **Rollback:** redeploy the previous Pages build (stored text is plain and
  untouched, so nothing to migrate back).

## Not in scope
Toolbar/WYSIWYG, raw-HTML passthrough, markdown in titles, live edit preview,
image upload.
