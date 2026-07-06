# Playbook: Jira ↔ kbRelay round-trips (agent SOP)

**Audience:** an AI agent (Claude Code, Cursor, …) that has BOTH the **Atlassian/Jira**
MCP-or-REST access *and* the **kbRelay MCP** (`@alacrity-ai/kbrelaymcp`).

**The idea:** Jira is often the company system-of-record, but kbRelay is where the
*agent-assisted work* actually happens. The agent is the integration — kbRelay does
**not** talk to Jira. kbRelay just stores a durable, provenance-carrying **external
link** (`link_card`) so the connection is visible and de-dup-queryable
(`find_cards_by_link`). See KBR-87 (design) and KBR-88 (the links primitive).

---

## The canonical flow

> "Get `RDRBS-1234` from Jira, make kbRelay tickets linked to it, do the work, then
> update `RDRBS-1234` with the proof."

```
1. READ (Jira)      Fetch the issue: title, description, acceptance, status.
2. DE-DUPE (kbRelay) find_cards_by_link(projectId, "jira", "RDRBS-1234")
                     → if a card already exists, use it; do NOT create a duplicate.
3. CREATE (kbRelay)  create_card(summary, description, acceptanceCriteria) in the
                     target project, then link_card(cardId, provider:"jira",
                     externalKey:"RDRBS-1234", url:<issue URL>, title:<issue title>).
                     Split into multiple linked cards if the Jira issue is large —
                     link each back to the same externalKey.
4. BACK-LINK (Jira)  Add a remote link / comment on RDRBS-1234 pointing at the
                     kbRelay card (its key + URL). Now both sides reference each other.
5. WORK (kbRelay)    Do the work. Use the timeline: add_comment(type:"note"/"handoff"),
                     move the card Ready → In Progress → In Review. Human closes.
6. REPORT (Jira)     When done, comment on RDRBS-1234 with the results/proof and
                     transition the Jira issue. Leave the kbRelay link in place.
```

Only steps 2–3 touch anything new in kbRelay; everything else already existed.

---

## The kbRelay tools you use

| Tool | When | Notes |
|------|------|-------|
| `find_cards_by_link(projectId, provider, externalKey)` | **before creating** | De-dupe. Returns each matching card (`cardId`, `cardKey`, `cardSummary`) + the link. Empty ⇒ safe to create. |
| `link_card(cardId, provider, url, externalKey?, title?)` | after creating the card | `provider` is free text — use `"jira"` (or `"github"`, `"linear"`, …). Set `externalKey` to the issue key so the card is findable. |
| `unlink_card(linkId)` | link was wrong | Creator or admin only. |

`provider`/`externalKey` conventions:
- **Jira**: `provider:"jira"`, `externalKey:"<PROJECT>-<n>"` (e.g. `"RDRBS-1234"`), `url:` the browse URL.
- **GitHub**: `provider:"github"`, `externalKey:"<org>/<repo>#<n>"`.
- Keep `provider` lowercase and stable so `find_cards_by_link` matches.

The link shows as a 🔗 chip on the card in the kbRelay web UI, and rides along on the
card's single-GET (`links[]`) with `linkCount` on the board list.

---

## Rules of thumb

- **Always de-dupe first** (`find_cards_by_link`) — re-running the flow on the same
  Jira issue must not spawn duplicate cards.
- **kbRelay never calls Jira.** If the Jira issue's status/title changes, the agent
  refreshes the kbRelay side on its next pass; there is no background sync.
- **Provenance is automatic** — the link records who created it (human vs agent).
- **Spec vs. log**: put the plan in the card's `description`/`acceptanceCriteria`;
  report progress on the **timeline** (`add_comment`), don't rewrite history.
- **No Jira creds in kbRelay.** The agent holds Jira access; kbRelay holds only the
  link. This keeps kbRelay tool-agnostic and self-hostable.

---

## Degraded mode (no links primitive yet)

If you're on a kbRelay instance from before KBR-88, drop the link into the card's
`description` (first line: `Jira: RDRBS-1234 — <url>`) or a `note` comment. You lose
the queryable de-dupe (`find_cards_by_link`) and the chip, but the round-trip still
works by convention.
