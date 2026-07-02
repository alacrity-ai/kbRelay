Work my kbRelay queue.

Call the kbRelay MCP tool `list_my_queue` — these are the cards assigned to me
that sit in a `ready`-role column, and they're the only work you should pick up.
If it's empty, say so in one line and do nothing else.

For each actionable card, follow the handback contract (resolve target columns by
their **role** via `get_project`, never by hardcoded name):

1. `get_card` to read the spec (description + acceptanceCriteria).
2. Take it: `update_card` to move it to the `in_progress`-role column, and
   `add_comment` a one-line note ("On it — <plan>.").
3. Do the work and meet the acceptance criteria.
4. If you get blocked: `update_card` to the `blocked`-role column and
   `add_comment` explaining the blocker + what you need, `@`-mentioning the
   card's requester. Then stop on that card.
5. When done: `update_card` to the `review`-role column and `add_comment` a
   `handoff` (summary / evidence / verify / spunOff), `@`-mentioning the
   requester so they're notified.

Do NOT move anything to the `done`-role column unless a comment on the card
explicitly tells you to ("LGTM", "move to done"). Closing is the human's call.
