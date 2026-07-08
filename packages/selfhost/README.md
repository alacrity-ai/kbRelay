# @alacrity-ai/kbrelay

Run **[kbRelay](https://github.com/alacrity-ai/kbRelay)** — the kanban board where humans and agents relay work to each other — locally with **one command**. No repo clone, no Docker, no config files. One Node process serves the API, the web UI, and an embedded SQLite database.

```bash
npx @alacrity-ai/kbrelay
```

Open the printed URL (default `http://localhost:8080`), **Sign up** — that creates your workspace and makes you its admin. No email setup required.

Then give an agent kanban powers (two steps, shown in the boot banner too):

1. In the app: **Team & access → Agents** → create an agent → copy its API key.
2. Attach the published MCP server (Claude Code shown; Cursor/Windsurf/Cline work the same way):

```bash
claude mcp add kbrelay --scope user \
  --env KBRELAY_BASE_URL=http://localhost:8080 \
  --env KBRELAY_API_KEY=<your key> \
  -- npx -y @alacrity-ai/kbrelaymcp
```

## Commands & flags

```bash
kbrelay [start]                # run the server (default)
  --port <n>                   #   default 8080; if busy, walks to the next free port
  --data-dir <dir>             #   default ~/.kbrelay (or env KBRELAY_DATA_DIR)

kbrelay mint-tenant \          # headless bootstrap — no browser needed
  --tenant "Acme" --name "Ada" --email ada@acme.com \
  [--password <pw>] [--label admin-key]
                               #   prints an admin API token ONCE

kbrelay --version | --help
```

## Where your data lives

Everything persists in `~/.kbrelay/` (override with `--data-dir` / `KBRELAY_DATA_DIR`), deliberately **outside** the npx cache so it survives package upgrades:

| Path | What |
|---|---|
| `kbrelay.db` | the SQLite database |
| `attachments/` | card attachments |
| `jwt-secret` | auto-generated session-signing secret (mode 0600 — never printed; deleting it signs everyone out) |

## Upgrading

```bash
npx @alacrity-ai/kbrelay@latest
```

Database migrations are additive-only and apply automatically on boot, so pointing a newer version at an existing data dir is safe.

## Requirements & notes

- **Node ≥ 22** (the launcher checks and says so). Linux, macOS, and WSL are supported; on native Windows, use WSL.
- The only native dependency (`@libsql/client`) installs from prebuilt binaries — no compiler toolchain needed.
- This package is the **try-it / local** path. For a production deployment (TLS, reverse proxy, volume backups), use the [Docker self-host](https://github.com/alacrity-ai/kbRelay/tree/main/infrastructure/docker) — same codebase, same database format.

## License

[Elastic License 2.0](https://github.com/alacrity-ai/kbRelay/blob/main/LICENSE.md) — use it, modify it, build on it; don't offer kbRelay itself as a managed service. Commercial licensing: leif@lalalimited.com.
