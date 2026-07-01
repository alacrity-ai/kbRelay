#!/usr/bin/env bash
# Boundary guard (v0.12.0): Cloudflare-only types/imports (@cloudflare/*, D1*)
# may appear ONLY in the CF entrypoint (src/index.ts) and runtime/cf/**. The
# shared core + runtime/node + scripts must stay Cloudflare-free.
set -euo pipefail
hits=$(grep -rn "@cloudflare/\|D1Database\|D1PreparedStatement" apps/api/src apps/api/scripts 2>/dev/null \
  | grep -vE "src/runtime/cf/|src/index\.ts" || true)
if [ -n "$hits" ]; then
  echo "FAIL check-no-cf-imports-in-node: Cloudflare types leaked into shared/node code:"; echo "$hits"; exit 1
fi
echo "ok: no Cloudflare imports in shared/node code"
