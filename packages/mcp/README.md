# @alacrity-ai/kbrelaymcp

An [MCP](https://modelcontextprotocol.io) server that gives an agent **kbRelay**
powers — projects, cards, the timeline, and your @-mentions — over kbRelay's HTTP
API. It's a thin, standalone stdio client: it carries no privileges of its own, so
the API token's tenant and **project access (RBAC)** govern exactly what it can see
and do. Point it at a token minted for an **agent user** and everything the agent
does is attributed to that agent (correct provenance).

## Install (Claude Code / Claude Desktop)

```bash
claude mcp add kbrelay --scope user \
  --env KBRELAY_BASE_URL=https://kbrelay.lalalimited.com \
  --env KBRELAY_API_KEY=<token from the web "API keys" panel> \
  -- npx -y @alacrity-ai/kbrelaymcp
```

`KBRELAY_BASE_URL` can point at the hosted deployment **or** a self-host instance
(e.g. `http://localhost:8080`), so the same MCP works against both.

### Other MCP clients (Cursor / Windsurf / Cline)

```json
{
  "mcpServers": {
    "kbrelay": {
      "command": "npx",
      "args": ["-y", "@alacrity-ai/kbrelaymcp"],
      "env": {
        "KBRELAY_BASE_URL": "https://kbrelay.lalalimited.com",
        "KBRELAY_API_KEY": "<your token>"
      }
    }
  }
}
```

## Configuration

| Env var | Required | Purpose |
|---|---|---|
| `KBRELAY_BASE_URL` | yes | kbRelay origin, e.g. `https://kbrelay.lalalimited.com` or `http://localhost:8080`. |
| `KBRELAY_API_KEY` | yes | A bearer token. For correct provenance, use a key minted for an **agent user** (web → *Team & access → Agents*) so the agent's work is attributed to it, not to you. A personal key from the **API keys** panel also works. Sent as `Authorization: Bearer …`. |

## Tools

| Tool | Kind | What it does |
|---|---|---|
| `whoami` | read | The current user + tenant (call first for your user id). |
| `list_users` | read | Tenant users → resolve names/@handles to ids. |
| `list_projects` | read | Projects you can access (admins: all). |
| `get_project` | read | A project + its columns (resolve column ids by name). |
| `create_project` | write | New project (`code` required, seeds columns). **Admin keys only** since KBR-94 — member keys get 403. |
| `update_project` | write | Edit a project's name/code/description/color/status. **Admin keys only** since KBR-94. |
| `list_cards` | read | Cards in a project (filter by column/assignee/q). |
| `get_card` | read | One card (read the spec before working it). Returns `attachments[]` — each with `filename`, `kind`, `sizeBytes`, and a same-origin `url` to fetch the bytes (v0.16.0). |
| `create_card` | write | New card (markdown body; `@handle` to notify). |
| `update_card` | write | Edit and/or **move** (set `columnId` — status = column). Restoring an archived card (`archived:false`) is admin-only (KBR-94). |
| `delete_card` | write | Delete a card (cascades). |
| `get_timeline` | read | A card's activity log (events + comments). |
| `get_project_activity` | read | Newest-first card events across a whole board — "what happened while I was away?" (cursor-paginated, v0.17.0). |
| `add_comment` | write | Report results on the timeline (note or handoff); `attachmentIds` links uploaded files. |
| `add_attachment` | write | Upload a file to a card (`filePath` or base64, ≤25 MB) → attachment + markdown snippet (v0.17.0). |
| `delete_attachment` | write | Delete an attachment (uploader or admin; bytes purged). |
| `redact_comment` | write | Soft-delete your own comment (leaves a tombstone). |
| `list_my_queue` | read | Your actionable queue — cards assigned to you in a `ready`-role column (v0.15.0). Work these first. |
| `get_mentions` | read | Your @-mentions — "what did people ask me?". |
| `mark_mentions_read` | write | Acknowledge mentions after handling them. |

The `get_mentions` + `add_comment` pair makes *"check your mentions and respond to
them"* a first-class flow, and `add_attachment` + `add_comment` (`attachmentIds`)
makes *"attach the evidence to the handoff"* one too.

## Requirements

Node ≥ 20. No configuration files — just the two env vars.

## License

MIT
