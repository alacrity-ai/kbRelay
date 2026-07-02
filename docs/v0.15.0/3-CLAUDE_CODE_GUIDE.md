# kbRelay v0.15.0 — "Claude Code Setup" Guide/Tutorial Modal

**Status:** Design, ready to build **after** the flow feature lands (KBR-9…13),
since the guide teaches that exact flow. Companion to
[`2-HUMAN_AGENT_FLOWS_DESIGN.md`](./2-HUMAN_AGENT_FLOWS_DESIGN.md) (the canonical
flow this modal explains) and [`0-CALLBACK_RESEARCH.md`](./0-CALLBACK_RESEARCH.md)
(the setup options it lists). Grounded in the current web code.

**Goal:** a first-class **"Claude Code Setup"** entry in the user menu that opens
a **paged, tutorial-style modal**. It does two jobs: (1) **configure** — copyable
setup commands (MCP connect, `/loop`, channels) so a user knows exactly how to
wire their Claude Code; and (2) **teach** — a canonical, *animated* walkthrough
of the relay flow using the same visual language as the board (a card moving from
column to column), so people know precisely how delegation works and trust it.

---

## 1. Entry point

Add a menu item to the account dropdown in `apps/web/src/pages/BoardApp.tsx`
(the `Dropdown` at ~L216–264), right before **API keys** (L261):

```tsx
<button className="menu-item" onClick={() => setGuideOpen(true)}>Claude Code setup</button>
```

`const [guideOpen, setGuideOpen] = useState(false)` alongside the existing
`apiKeysOpen`/`teamOpen` state, and render `{guideOpen && <ClaudeCodeGuide
me={me} onClose={() => setGuideOpen(false)} />}` beside the other modals
(~L323). Available to **everyone** (not admin-gated) — every user connects their
own agent.

---

## 2. Component: `apps/web/src/components/ClaudeCodeGuide.tsx`

A self-contained paged modal, styled with the **existing** modal system
(`dialog-backdrop` / `dialog-card` / `modal-header` / `modal-header-actions`,
already used by `McpGuide.tsx` and `ProjectSettings.tsx`) — no new modal
framework.

- **Paged wizard.** Local `const [page, setPage] = useState(0)`; a footer with
  **Back / Next**, a **page-dot indicator**, and **Done** on the last page.
  Escape closes (reuse the `useEffect` keydown pattern from `McpGuide`). Arrow
  keys ←/→ page. Mobile: pages stack; footer sticks.
- **Copy buttons.** Reuse `McpGuide`'s `navigator.clipboard.writeText` + "Copied!"
  pattern for every code block (factor a tiny `<CopyBlock code={…} />` helper so
  each snippet is one line and the copy behavior is consistent).
- **Base URL** is derived from `window.location.origin` (same trick as
  `McpGuide`) so the printed commands are correct on prod *and* self-host.
- **Single source of truth:** the `claude mcp add kbrelay …` command currently
  lives inline in `McpGuide.tsx`. Extract it (and any shared snippets) into
  `apps/web/src/lib/setupSnippets.ts` and have **both** `McpGuide` and
  `ClaudeCodeGuide` import it, so they can never drift.

### 2.1 The animated flow demo — `<FlowDemo step={n} />`

The tutorial's centerpiece and the "use UI elements we already have" ask. A
**lightweight, non-interactive mock board** (NOT the real `Board` — no DnD, no
API) that reuses the board's CSS (`.column`, `.card`, the **role badge** from
KBR-12) to render ~5 mini lanes: **Backlog · Ready · In Progress · In Review ·
Done** (Blocked shown when relevant). A single demo card ("KBR-42 · Fix the
mint-token script", in Claude's color) **animates between lanes** via a CSS
`transform`/`transition` keyed off the `step` prop.

- Driven by the page/step: advancing the tutorial moves the card one lane and
  updates the caption. (Optional: a subtle auto-advance loop on the final
  "recap" page.)
- Small "actor" tag on each transition — 🧑 *you* vs 🤖 *Claude* — to make
  provenance and who-does-what unmistakable (mirrors kbRelay's human/agent
  symmetry and the `kind-badge` in the nav).
- Purely presentational; safe to ship without touching board logic.

---

## 3. Pages (content)

A tight **6-page** arc — configure first, then teach the flow, then the safety
rules and a cheat-sheet.

### Page 1 — What this is
One-paragraph framing ("kbRelay is where you and Claude relay work — you file and
authorize tickets, Claude works them, everything's audited on the timeline") +
a static `<FlowDemo step={0} />` showing the full lane layout with role badges,
so the vocabulary (Ready / In Progress / In Review / Done / Blocked) is
established up front.

### Page 2 — Connect Claude to kbRelay (MCP)
The copyable connect command (from `setupSnippets.ts`, origin-aware):
```
claude mcp add kbrelay --scope user \
  --env KBRELAY_BASE_URL=<origin> \
  --env KBRELAY_API_KEY=<your key> \
  -- npx -y @alacrity-ai/kbrelaymcp
```
+ a one-line "get a key" pointer to **API keys** (deep-link: close the guide and
open `ApiKeysModal`) and, for admins, **Team & access → Agents** for an
agent-user key. Note: this is the *pull* surface (Claude can read/work tickets);
the next page makes Claude *hear about* new work.

### Page 3 — Make Claude hear about work (pick one)
Two copyable options, framed as the phasing from the callback research:
- **Simplest (polling), today:**
  ```
  /loop 10m work my kbRelay queue
  ```
  and a `.claude/loop.md` snippet (drains `list_my_queue`, follows the handback
  contract). "Leave a session running; Claude checks every 10 min."
- **Push (channels), when you want instant reaction:** the short
  `claude --channels …` setup pointer + link out to the channel plugin (per
  KBR-8). Marked "research preview." Keep copy minimal; link for depth.

Tone: "you don't need both — start with `/loop`."

### Page 4 — The relay flow (the tutorial heart) — animated
Step through the canonical flow with `<FlowDemo>` advancing one lane per sub-step
and a caption for each. This **spells out and canonicalizes** the contract from
`2-HUMAN_AGENT_FLOWS_DESIGN.md §7`:
1. 🧑 You drag a card into **Ready** (assigned to Claude). *"This is you turning
   the faucet on — one card, deliberately."*
2. 🤖 Claude picks it up → **In Progress** + a "taking this" note. *"You see it
   working immediately."*
3. 🤖 Claude does the work.
4. 🤖 → **In Review** + a **handoff** comment (summary/evidence/verify) and
   @-mentions you → 🔔 you get notified.
5. 🧑 You review; comment "LGTM / move to done", or send it back.
6. 🤖 (only when told) → **Done**. *"Nothing auto-completes — closing is yours."*
Include the **Blocked** detour as a small aside: 🤖 stuck → **Blocked** + a note
explaining why + @you.

### Page 5 — The rules that keep it safe
Four short bullets (the anti-runaway / anti-dead-air guarantees):
- **You meter the work** — only `Ready` + assigned cards are fair game; drag one
  or drag five, your call.
- **Claude shows its hand** — In Progress + a note the moment it starts.
- **Nothing auto-completes** — finished work waits in In Review for you.
- **Stuck ≠ silent** — blockers land in Blocked with a reason and a ping.

### Page 6 — Cheat-sheet / recap
A compact reference card: the MCP command, `/loop 10m work my kbRelay queue`, the
lane meanings, and "assign to Claude + move to Ready = go." A "Done" button
closes. (Optional auto-playing `<FlowDemo>` in the background.)

---

## 4. Reuse & consistency

| Need | Reuse |
|------|-------|
| Modal shell / header / close | `dialog-backdrop`, `dialog-card`, `modal-header` (as in `McpGuide`, `ProjectSettings`) |
| Copyable code + "Copied!" | `McpGuide`'s clipboard pattern → extract `<CopyBlock />` |
| Origin-aware base URL | `window.location.origin` (as in `McpGuide`) |
| MCP connect command | extract to `lib/setupSnippets.ts`; shared with `McpGuide` |
| Mini board visuals | board CSS `.column`/`.card` + the **role badge** from KBR-12 |
| Actor labels | the `kind-badge` / avatar-color idiom from the nav |
| Deep-links | reuse existing `ApiKeysModal` / Team open handlers |

Web-only feature — **no API or schema changes**, so no migration, no parity
concern. (It only *reads* `me` for the user's color/name.)

---

## 5. Dependencies & sequencing

Build **after** KBR-9…13 so the tutorial depicts the shipped reality:
- **KBR-9 / KBR-12** — column roles + the role badge the `<FlowDemo>` reuses.
- **KBR-11** — `list_my_queue` (referenced in the `/loop` copy).
- **KBR-13** — the canonical handback contract wording (this modal is its
  human-facing mirror; keep them in lockstep).

If it's built earlier, the flow copy must be marked "coming in v0.15.0."

---

## 6. Acceptance (for the single ticket, KBR-15)

- A **"Claude Code setup"** item appears in the account menu for all users and
  opens a paged modal.
- The modal has **≥5 pages** with Back/Next + a page indicator; Escape and the
  ✕ close it; usable on mobile.
- Setup pages show **copyable** code blocks (MCP connect, `/loop`) with working
  copy-to-clipboard; the MCP command is **origin-aware** and **shared** with
  `McpGuide` (no duplicated string).
- At least one page uses an **animated mini-board** (`<FlowDemo>`) reusing the
  board's column/card visuals to show a card relaying Ready → In Progress → In
  Review → Done, with actor (you/Claude) labels.
- The flow pages match the canonical contract in
  `2-HUMAN_AGENT_FLOWS_DESIGN.md §7` (In Progress on pickup, Review by default,
  Done only when told, Blocked + reason).
- Typecheck / lint / build green; no API/schema changes.
</content>
