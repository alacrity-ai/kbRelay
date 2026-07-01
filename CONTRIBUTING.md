# Contributing to kbRelay

Thanks for the interest. This covers what you need before sending a pull
request: licensing terms, local-dev setup, the conventions the CI guards
enforce, and the review loop.

## License & contributor terms

kbRelay is licensed under the **Elastic License 2.0** (see [`LICENSE.md`](./LICENSE.md)).

By submitting any code, documentation, or other content to this repository, you agree that:

1. **Your contribution is licensed under the same Elastic License 2.0** as the rest of the project.
2. **You have the right to make the contribution** — you wrote it, or have permission to submit it under the project's license.
3. **You sign off on every commit** using the [Developer Certificate of Origin (DCO)](https://developercertificate.org/) — see below.

We use the DCO rather than a CLA because it's lightweight. We may add a CLA later for substantial contributions if a re-licensing scenario arises; we'd notify all contributors first.

### Sign your commits (DCO)

Add a `Signed-off-by:` line to every commit — git does it for you with `-s`:

```bash
git commit -s -m "fix: recompute recency order after project delete"
```

```
Signed-off-by: Real Name <email@example.com>
```

Forgot? `git commit --amend -s` (or for several commits, `git rebase -i HEAD~N -x 'git commit --amend --no-edit -s'`).

## Before you start work

For anything beyond a typo or one-line fix:

1. **Open an issue first.** Describe the change and why. A maintainer may have context (an in-flight change, a planned refactor) that's faster to surface in an issue than in review.
2. **Read [`.claude/CONTEXT.md`](./.claude/CONTEXT.md)** for the architecture, and the relevant `docs/vX.Y.Z/` design docs.
3. **For non-trivial features** (a new route, a new MCP tool, a schema change), draft a short design note under `docs/` mirroring the existing per-version format. PRs implementing features without a rationale tend to bounce.

## Local development

**Prereqs:** Node 24+ (`nvm use 24`), pnpm 10.

```bash
pnpm install                 # or: make install
make dev                     # web :5173 + api :8787 (local Miniflare D1)
make db-migrate-local        # apply migrations to the local D1
make test                    # unit tests (shared + api + mcp)
make typecheck lint          # tsc (4 workspaces) + eslint (--max-warnings 0)
make check-boundaries        # CF/Node import + inline-SQL guards
```

Each workspace: `apps/api/` (Worker + Node self-host API), `apps/web/` (React SPA), `packages/shared/` (types + zod), `packages/mcp/` (MCP server). Self-host stack: `make selfhost-up`.

## Code conventions

Summary rules — for the full picture, read existing code in the area you're touching.

- **TypeScript strict.** Use `?` for optional fields, not `| undefined` to mean "absent."
- **Zod is the source of truth for schemas.** Add new wire shapes to `packages/shared/src/`; don't redefine them in routes or the web client. The MCP derives its JSON Schema from these via `zod-to-json-schema`.
- **Tenant-scope everything.** Every DB read/write helper takes `tenantId`. If you're writing a query without `WHERE tenant_id = ?`, stop.
- **No inline SQL outside `apps/api/src/db/repos/`.** A CI guard (`tools/check-no-inline-db.sh`) enforces it, and all SQL goes through the `Db` port (`env.db`), never a raw D1 binding — extend a repo rather than carving an exception.
- **CF/Node import boundaries.** Code outside `apps/api/src/runtime/node/` must not import `node:*` / `@libsql/*` / `@whatwg-node/*`; Node-runtime code must not import CF-only types. Two CI guards enforce this. (Test files are exempt.)
- **RBAC access scopes.** Every project/card/column route must declare an `access` scope in `src/router.ts` (or be in the coverage test's explicit exempt list). `apps/api/src/access.test.ts` iterates the router and fails CI if a scoped route is missing its guard.
- **OpenAPI parity.** Document every `/api/v1` route in `src/openapi.ts`; `openapi.test.ts` checks the spec and the router match exactly, both directions.
- **Errors** throw `HttpError` and render via `jsonResponse` / `errorResponse` — don't return raw error JSON from a handler.
- **Comments** default to none. Add one when the *why* is non-obvious (a hidden constraint, a workaround, a surprise); don't restate what the code does.

## Tests

PRs need tests for the change they introduce, unless it's purely cosmetic.

- **Shared schemas** — `packages/shared/src/*.test.ts`.
- **API** — `apps/api/src/**/*.test.ts` (Vitest). Repo tests run against an **in-memory libsql** DB using the *same migration tree* as prod, so they exercise real SQLite behavior.
- **MCP** — `packages/mcp/src/*.test.ts`.

Run before pushing:

```bash
make typecheck lint check-boundaries
make test
```

## Pull request flow

1. Branch off `main` (or the active branch).
2. Small, focused commits — each `Signed-off-by:`'d.
3. Open a PR with a short imperative title, a body of **what + why + scope**, a link to the issue/design doc, and a **test plan** (what you ran).
4. CI must be green (typecheck, lint, tests, boundary + RBAC + OpenAPI-parity guards).
5. A maintainer reviews. Address comments with additional commits (avoid force-push during review — it preserves the thread).
6. After approval, the maintainer squash- or rebase-merges.

## License headers (optional)

If you want to mark new files, the canonical block is:

```ts
// Copyright (c) 2026 LaLa Solutions.
// Licensed under the Elastic License 2.0. See LICENSE.md in the repository root.
```

## Reporting bugs

Open an issue with: steps to reproduce, the version / commit, the deploy mode (Cloudflare or self-host), and relevant log lines **redacted of secrets**. For **security** issues, contact a maintainer privately — do not open a public issue.

Doc bugs are real bugs — an issue, or (better) a PR that fixes the doc, is welcome.

## Code of conduct

Be civil. Treat reviewers and contributors with respect.

## Questions

If this doesn't answer your question, open an issue with the `question` label or reach out to a maintainer. We'd rather you ask than ship something that needs a major rewrite in review.

Thanks for contributing.
