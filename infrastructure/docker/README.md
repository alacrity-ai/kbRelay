# Self-hosting kbRelay (Docker — the production path)

> **Just want to try kbRelay locally?** Skip Docker entirely: `npx @alacrity-ai/kbrelay`
> boots the same app in one command (see [`packages/selfhost/README.md`](../../packages/selfhost/README.md)).
> This Docker path is for durable deployments — TLS proxy, named volume, backups.
> Both share one database format.

Run kbRelay (API + web + database) as **one Docker container** with **no Cloudflare
dependency**. The container serves the API and the built SPA from the same origin and
stores everything in an embedded SQLite database on a named volume. Same codebase as the
Cloudflare deployment — only the entrypoint differs.

## Quick start

```bash
# From the repo root:
cp infrastructure/docker/.env.selfhost.example infrastructure/docker/.env.selfhost
# Edit .env.selfhost — at minimum set a long random JWT_SECRET:
#   openssl rand -base64 48

make selfhost-up        # build + start (migrations auto-apply on boot)
```

The app is now at **http://localhost:8080**. Create your first workspace + admin + API
token offline (no email needed):

```bash
make selfhost-mint-tenant TENANT="Acme" NAME="Your Name" EMAIL=you@acme.com PASSWORD='choose-one'
#  → prints an API token once. Use it as: Authorization: Bearer <token>
#  → or sign in at http://localhost:8080 with the email + password.
```

`TENANT`, `NAME`, and `EMAIL` are required (`NAME` is your display name on the
board). `PASSWORD` is optional — omit it and a strong one is generated and
printed once. `LABEL` names the API token (default `admin-key`).

Other targets: `make selfhost-logs`, `make selfhost-migrate` (also runs on boot),
`make selfhost-down` (stops; keeps the data volume).

## How it works

- **One image** (`apps/api/Dockerfile`, multi-stage): builds the SPA (Vite) and bundles
  the Node server + migrate/mint CLIs (esbuild). Runtime carries the bundle + SPA +
  migrations + the native SQLite client (`@libsql/client`).
- **One service** (`docker-compose.yml`): the app + a `kbrelay-data` volume for
  `/data/kbrelay.db`. No separate database container.
- **One migration tree**: the exact `apps/api/migrations/*.sql` files run on both
  Cloudflare D1 and libsql (identical SQLite dialect) via `dist-node/migrate.js`.
- **Two auth modes still work**: agents use bearer tokens (mint via the CLI or the
  in-app **API keys** panel); humans sign in with email/password. RBAC is enforced
  identically to the hosted deployment.

## Configuration (`.env.selfhost`)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | SQLite location — default `file:/data/kbrelay.db` (the volume). |
| `JWT_SECRET` | **Required** for human sign-in. Long random string. |
| `PUBLIC_BASE_URL` | Public URL (links + cookie `Secure` flag). `https://…` behind a proxy. |
| `PORT` | Host/container port (default 8080). |
| `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` | Optional. Unset → welcome/reset/invite emails are a no-op (use the mint CLI to onboard). |

## Production notes

- Put a TLS-terminating reverse proxy (Caddy/nginx/Traefik) in front and set
  `PUBLIC_BASE_URL=https://your.domain` so session cookies are marked `Secure`.
- Back up the `kbrelay-data` volume (or point `DATABASE_URL` at a networked
  `sqld`/libSQL server and use its replication) — see the design doc's out-of-scope note.
