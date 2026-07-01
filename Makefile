.PHONY: help install dev dev-web dev-api build lint typecheck clean \
       db-migrate-local db-migrate-dev db-migrate-prod db-reset-local \
       deploy-web-dev deploy-web-prod deploy-api-dev deploy-api-prod \
       deploy-dev deploy-prod \
       selfhost-up selfhost-down selfhost-logs selfhost-migrate selfhost-mint-tenant \
       check-boundaries \
       test test-unit test-e2e \
       cf-d1-create mint-token seed-local

# Cloudflare credentials come from the environment. Source them from the
# gitignored DO_NOT_COMMIT.md before running any cf-* / deploy target:
#   export CLOUDFLARE_API_TOKEN=...   export CLOUDFLARE_ACCOUNT_ID=...
# (or `set -a; source ./cf.env; set +a` if you keep a local cf.env)

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── Setup ──────────────────────────────────────────────────

install: ## Install all workspace dependencies
	pnpm install

# ── Local development ──────────────────────────────────────

dev: ## Start web + api together (Ctrl-C stops both)
	@echo "Starting api on :8787 and web on :5173. Ctrl-C to stop both."
	@trap 'kill 0' INT TERM; \
	 ( $(MAKE) --no-print-directory dev-api 2>&1 | sed 's/^/[api] /' ) & \
	 ( $(MAKE) --no-print-directory dev-web 2>&1 | sed 's/^/[web] /' ) & \
	 wait

dev-web: ## Start Vite dev server on :5173
	pnpm --filter @kbrelay/web run dev

dev-api: ## Start wrangler dev on :8787 (env.dev config, local Miniflare + local D1)
	pnpm --filter @kbrelay/api run dev

# ── Quality ────────────────────────────────────────────────

build: ## Build all workspaces
	pnpm -r run build

typecheck: ## Typecheck all workspaces
	pnpm -r run typecheck

lint: ## Lint all workspaces
	pnpm run lint

clean: ## Remove build artifacts + node_modules
	rm -rf node_modules apps/*/node_modules packages/*/node_modules \
	       apps/web/dist apps/api/.wrangler coverage

# ── Database ───────────────────────────────────────────────

db-migrate-local: ## Apply D1 migrations to the local Miniflare DB
	pnpm --filter @kbrelay/api run db:migrate:local

db-migrate-dev: ## Apply D1 migrations to the remote dev DB
	pnpm --filter @kbrelay/api run db:migrate:dev

db-migrate-prod: ## Apply D1 migrations to the remote prod DB
	pnpm --filter @kbrelay/api run db:migrate:prod

db-reset-local: ## Wipe + re-migrate the local Miniflare DB
	rm -rf apps/api/.wrangler/state/v3/d1
	$(MAKE) --no-print-directory db-migrate-local

# ── Cloudflare provisioning (one-time) ─────────────────────

cf-d1-create: ## Create the prod + dev D1 databases (paste the printed IDs into wrangler.toml)
	cd apps/api && npx wrangler d1 create kbrelay
	cd apps/api && npx wrangler d1 create kbrelay-dev

# ── Tokens ─────────────────────────────────────────────────
# Mint an API token for a user. Generates a 32-byte token, stores only its
# sha256 hash in api_tokens, prints the PLAINTEXT once. Give it to the human
# (they paste it into the web UI) or the agent runtime.
#   make mint-token TARGET=local TENANT=lala USER=claude LABEL=claude-main
#   make mint-token TARGET=dev   TENANT=lala USER=leif   LABEL=leif-laptop
#   make mint-token TARGET=prod  TENANT=lala USER=joe    LABEL=joe-laptop
TARGET ?= local
TENANT ?= lala
USER   ?= claude
LABEL  ?= $(USER)-main
mint-token: ## Mint an API token. Vars: TARGET=local|dev|prod TENANT= USER= LABEL=
	@node tools/mint-token.mjs --target=$(TARGET) --tenant=$(TENANT) --user=$(USER) --label=$(LABEL)

# ── Deploy ─────────────────────────────────────────────────

deploy-api-dev: ## Deploy Worker to dev
	cd apps/api && npx wrangler deploy --env dev

deploy-api-prod: ## Deploy Worker to prod
	cd apps/api && npx wrangler deploy --env prod

deploy-web-dev: ## Build + deploy Pages to the dev project (kbrelay-dev)
	pnpm --filter @kbrelay/web run build
	cd apps/web && npx wrangler pages deploy dist --project-name kbrelay-dev --branch main

deploy-web-prod: ## Build + deploy Pages to the prod project (kbrelay)
	pnpm --filter @kbrelay/web run build
	cd apps/web && npx wrangler pages deploy dist --project-name kbrelay --branch main

deploy-dev: db-migrate-dev deploy-api-dev deploy-web-dev ## Full dev deploy
deploy-prod: db-migrate-prod deploy-api-prod deploy-web-prod ## Full prod deploy

# ── Self-host (Docker, no Cloudflare) ──────────────────────
# One container serves API + SPA with embedded SQLite in a volume. Copy
# infrastructure/docker/.env.selfhost.example → .env.selfhost first.
DC = docker compose -f infrastructure/docker/docker-compose.yml

selfhost-up: ## Build + start the self-host stack (migrations auto-apply on boot)
	$(DC) up -d --build --wait

selfhost-down: ## Stop the self-host stack (keeps the data volume)
	$(DC) down

selfhost-logs: ## Tail the self-host container logs
	$(DC) logs -f

selfhost-migrate: ## Apply migrations against the running volume (also runs on boot)
	$(DC) run --rm app node dist-node/migrate.js

# Mint a tenant + admin + API token offline (no email). Vars: TENANT= EMAIL= [PASSWORD=] [OWNER_NAME=]
selfhost-mint-tenant: ## Create a tenant + admin + token (offline). Vars: TENANT= NAME= EMAIL= [PASSWORD=] [LABEL=]
	$(DC) run --rm -e TENANT="$(TENANT)" -e NAME="$(NAME)" -e OWNER_NAME="$(OWNER_NAME)" -e EMAIL="$(EMAIL)" -e PASSWORD="$(PASSWORD)" -e LABEL="$(LABEL)" app node dist-node/mint-tenant.js

check-boundaries: ## Verify the CF/Node runtime boundary (shared code stays neutral)
	@for s in tools/check-no-*.sh; do bash $$s; done

# ── Tests ──────────────────────────────────────────────────

test: ## Run all workspace unit tests
	pnpm -r run test

test-unit: ## Alias for test
	pnpm -r run test

test-e2e: ## Run Playwright e2e (requires a running dev stack or E2E_START_STACK=1)
	cd test/e2e && pnpm test
