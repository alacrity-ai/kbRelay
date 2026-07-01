# kbRelay v0.13.0 — MCP Server (`@alacrity-ai/kbrelaymcp`)

**Shipped:** 2026-07-01 · **Design:** `../v0.10.0/4-MCP_DESIGN.md`

The final roadmap item. A published npm package so anyone can give an agent kbRelay
powers with one command — no bespoke integration.

```bash
claude mcp add kbrelay --scope user \
  --env KBRELAY_BASE_URL=https://kbrelay.lalalimited.com \
  --env KBRELAY_API_KEY=<token from the web "API keys" panel> \
  -- npx -y @alacrity-ai/kbrelaymcp
```

## What shipped (`packages/mcp`)

- **Standalone stdio MCP server** — low-level `@modelcontextprotocol/sdk` `Server`
  over `StdioServerTransport`; a bin shim (`bin/kbrelaymcp.mjs`) that `npx` runs.
- **Inline fetch client** (`src/client.ts`) — deliberately **no** workspace dep on
  `@kbrelay/shared`, so the published package is self-contained and `npx -y` needs
  nothing extra. Sends `Authorization: Bearer <KBRELAY_API_KEY>`; a 30s timeout;
  surfaces kbRelay's `{error, details}` as thrown errors.
- **Config = two env vars** — `KBRELAY_BASE_URL` (hosted **or** self-host) and
  `KBRELAY_API_KEY`. No profile files. Missing either → clear stderr + exit 2.
- **15 tools** (`defineTool` + zod → JSON Schema): `whoami`, `list_users`,
  `list_projects`, `get_project`, `create_project`, `list_cards`, `get_card`,
  `create_card`, `update_card`, `delete_card`, `get_timeline`, `add_comment`,
  `redact_comment`, `get_mentions`, `mark_mentions_read`. Descriptions teach the
  model kbRelay's conventions (status = column, report on the timeline, markdown,
  `@handle`, ticket keys). The `get_mentions` + `add_comment` pair makes *"check
  your mentions and respond to them"* first-class.
- **No privileges of its own** — the token's tenant + **RBAC project access** govern
  exactly what the MCP can see and do. The same package works against the Cloudflare
  deployment or a self-host instance via `KBRELAY_BASE_URL`.
- **Publish-ready** — `publishConfig.access: "public"` (the fix textral's package
  omitted), `files: [dist, bin, README]`, `engines.node >=20`, built with `tsc`.
- **Optional CI** — a tag-driven GitHub Action (`.github/workflows/publish-mcp.yml`,
  gated behind an approval environment) as an alternative to manual `npm publish`.

## Tests & validation

- **Unit** (11): every tool's zod schema accepts/rejects representative inputs and
  builds the right path/query; the client builds correct URLs/headers and maps
  errors (mocked `fetch`).
- **Integration** (12): the real MCP SDK client spawns the built bin over stdio and
  drives the full surface against a running kbRelay — tools/list (15), `whoami`,
  RBAC-scoped `list_projects`, the `create_card → get_timeline → add_comment`
  lifecycle, mentions, error mapping, and zod rejection.
- **Install smoke**: `npm pack` → install the tarball into a clean dir (deps
  resolve) → the installed bin boots and serves 15 tools. Confirms `npx -y` works
  from a clean spawn.

## Publishing

Primary is manual: `cd packages/mcp && npm publish --access public` (`prepublishOnly`
builds). The CI workflow is provided but optional. Version starts at `0.1.0` and
tracks the MCP's own tool surface, independent of the kbRelay app version.
