# kbRelay — v0.13.0 Design: MCP Server `@alacrity-ai/kbrelaymcp`

**Date:** 2026-07-01
**Status:** Design (pre-implementation). Item 4 of `0-ROADMAP_PLAN.md`.
**Depends on:** Item 1 (self-service API keys) + Item 2 (RBAC-scoped tokens).
**Grounded in:** textral (`/home/leif/textral/TEXTRAL_REFACTOR_WIP/packages/mcp`):
`package.json`, `bin/textral-mcp.mjs`, `src/{server,transport-stdio}.ts`,
`src/tools/*.ts`, `src/zod-to-input-schema.ts`; `packages/sdk/src/client.ts`.

---

## 1. Goal

A published npm package so anyone can give an agent kbRelay powers with:

```bash
claude mcp add kbrelay --scope user \
  --env KBRELAY_BASE_URL=https://kbrelay.lalalimited.com \
  --env KBRELAY_API_KEY=<token from the web API-keys panel> \
  -- npx -y @alacrity-ai/kbrelaymcp
```

The MCP is a **thin, standalone stdio client** over kbRelay's existing HTTP API. It
carries no privileges of its own — the token's tenant + **RBAC project access**
(Item 2) governs exactly what it can see and do. `KBRELAY_BASE_URL` points at either
the Cloudflare deployment or a self-host instance (Item 3), so the same MCP works
against both.

## 2. Package (`packages/mcp`)

`package.json` (grounded in textral, with the fix it was missing):
- `"name": "@alacrity-ai/kbrelaymcp"`, `"version": "0.1.0"`, `"type": "module"`,
  `"license": "MIT"`, `"private": false`.
- `"bin": { "kbrelaymcp": "./bin/kbrelaymcp.mjs" }` — what `npx` runs.
- `"files": ["dist", "bin", "README.md"]` (ship `dist` + the shim only).
- **`"publishConfig": { "access": "public" }`** — required for a scoped public
  package; **textral omitted this and a public publish would fail** — we include it.
- `"engines": { "node": ">=20" }`.
- Scripts: `"build": "tsc -p tsconfig.build.json"`, `"prepublishOnly": "npm run
  build"`, `"typecheck"`, `"test"`.
- Deps: `@modelcontextprotocol/sdk`, `zod`, `zod-to-json-schema`. **No workspace
  deps** (see §5) so `npx -y` resolves with nothing extra.

Build with plain **`tsc`** (NodeNext, `outDir dist`, `declaration`), so `dist/`
mirrors `src/` file-for-file (matches the bin shim's expectation).

## 3. Entry & transport (stdio)

- `bin/kbrelaymcp.mjs`: `#!/usr/bin/env node` shim that resolves paths from
  `import.meta.url`, dynamic-imports `../dist/transport-stdio.js`, and calls
  `startStdio()`. On failure prints to **stderr** and exits 2. (stdout is reserved for
  JSON-RPC.)
- `src/transport-stdio.ts`: resolve config (§4), log the active base URL to stderr,
  then:
  ```ts
  const server = createServer({ client });
  await server.connect(new StdioServerTransport());
  ```
- `src/server.ts`: low-level `Server` from `@modelcontextprotocol/sdk/server/
  index.js`, capabilities `{ tools: {} }`; `setRequestHandler(ListToolsRequestSchema)`
  maps `allTools` → `{name, description, inputSchema}`; `setRequestHandler(
  CallToolRequestSchema)` finds the tool by name, validates args with its zod schema,
  runs the handler, returns `{ content: [{ type:'text', text: JSON.stringify(result)
  }] }` (and `isError` on failure).

## 4. Config & auth (single KISS path)

Read two env vars (passed via `claude mcp add … --env …`):
- **`KBRELAY_BASE_URL`** (e.g. `https://kbrelay.lalalimited.com`; self-host
  `http://localhost:8787`).
- **`KBRELAY_API_KEY`** — a token from the web API-keys panel (Item 1).

The client sends **`Authorization: Bearer <KBRELAY_API_KEY>`** (kbRelay's existing
scheme — note textral used `x-…-api-key`; we match kbRelay). Missing either var →
exit with a clear stderr message. No TOML/multi-profile machinery (textral has it; we
don't need it).

## 5. API client (inline, standalone)

A tiny typed `fetch` wrapper **inside the package** (`src/client.ts`) — deliberately
**not** a workspace dependency on `@kbrelay/shared`, so the published package is
self-contained and `npx -y` needs no extra installs. It wraps `globalThis.fetch` with
the base URL + bearer header, JSON in/out, a 30s `AbortSignal` timeout, and surfaces
kbRelay's `{error, details}` shape as thrown errors. Response types are hand-mirrored
from the API (small surface). (If the shape drift ever bites, we can publish
`@kbrelay/shared` and depend on it — noted, not done.)

## 6. Tools

`defineTool({ name, description (≤200 chars), inputSchemaZod, handler })`; JSON Schema
derived from zod at load (`zod-to-json-schema`, `jsonSchema7`, `$refStrategy:'none'`,
`$schema` stripped). `allTools` registry in `src/tools/index.ts`. Initial surface
(all RBAC-scoped by the token):

| Tool | Wraps | Kind |
|---|---|---|
| `whoami` | `GET /v1/me` | read |
| `list_users` | `GET /v1/users` | read |
| `list_projects` | `GET /v1/projects` | read |
| `get_project` | `GET /v1/projects/:id` (+ columns) | read |
| `create_project` | `POST /v1/projects` | write |
| `list_cards` | `GET /v1/projects/:id/cards?column&assignee&q` | read |
| `get_card` | `GET /v1/cards/:id` | read |
| `create_card` | `POST /v1/projects/:id/cards` | write |
| `update_card` | `PATCH /v1/cards/:id` (edit **and/or** move) | write |
| `delete_card` | `DELETE /v1/cards/:id` | write |
| `get_timeline` | `GET /v1/cards/:id/timeline` | read |
| `add_comment` | `POST /v1/cards/:id/comments` (note/handoff) | write |
| `redact_comment` | `DELETE /v1/cards/:id/comments/:commentId` | write |
| `get_mentions` | `GET /v1/me/mentions?status` | read |
| `mark_mentions_read` | `POST /v1/me/mentions/read` | write |

Descriptions teach the model kbRelay's conventions (status = column, report on the
timeline not the description, write markdown, `@handle` to notify, ticket keys). The
`get_mentions` + `add_comment` pair makes *"check your mentions and respond to them"*
a first-class MCP flow.

## 7. README

`packages/mcp/README.md`: the `claude mcp add kbrelay …` line, the two env vars, a
generic JSON config block for Cursor/Windsurf/Cline (`"command":"npx","args":["-y",
"@alacrity-ai/kbrelaymcp"]`), the tool table, and Node ≥ 20.

## 8. Publishing

- **Primary (manual):** `npm publish --access public` from `packages/mcp`
  (`prepublishOnly` builds). Requires `npm login` / an `.npmrc` with the token.
- **Optional CI:** a **tag-driven GitHub Action** — `actions/setup-node` with
  `registry-url: https://registry.npmjs.org`, then `npm publish --access public` with
  **`NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`** (the CI token is in
  `DO_NOT_COMMIT.md`; add it as a repo secret). Gated behind a manual-approval
  environment, like textral's PyPI release workflow. (textral's MCP publish is manual;
  we offer both and default to manual for v1.)
- Versioning: start `0.1.0`; the MCP version tracks its own tool surface, independent
  of the kbRelay app version.

## 9. Resolved decisions

- **Inline client**, no `@kbrelay/shared` dep (standalone `npx`).
- **Bearer** auth, two env vars, no profile file.
- **Manual publish** for v1 (CI workflow provided but optional).
- **Low-level `Server`** + `defineTool` pattern (matches textral; predictable).
- **RBAC is the API's job** — the MCP adds no auth logic; a scoped token just works.

## 10. Testing

- **Unit:** each tool's zod schema accepts/rejects representative inputs; the client
  builds correct URLs/headers and maps errors (mock `fetch`).
- **Integration (local):** point `KBRELAY_BASE_URL` at a local dev/self-host instance
  with a minted token; exercise `list_projects → create_card → add_comment →
  get_mentions → mark_mentions_read`; confirm an **RBAC-scoped token only sees its
  granted projects** (ties Item 2 → Item 4).
- **Install smoke:** `npm pack`, then `npx ./<tarball>` under `claude mcp add` to
  confirm the bin shim + stdio handshake work from a clean spawn.

## 11. Out of scope (→ later)

Prompts/resources (MCP extras), streaming, an HTTP transport, multi-profile TOML
config, publishing `@kbrelay/shared`, write-scoped sub-tokens beyond RBAC.
