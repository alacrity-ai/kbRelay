#!/usr/bin/env bash
# Boundary guard (v0.12.0): all SQL must go through the `env.db` port — no raw
# D1 binding access (`env.DB`) that would bypass the port and break self-host.
set -euo pipefail
hits=$(grep -rn "env\.DB\b" apps/api/src 2>/dev/null || true)
if [ -n "$hits" ]; then
  echo "FAIL check-no-inline-db: raw env.DB bypasses the Db port:"; echo "$hits"; exit 1
fi
echo "ok: no raw env.DB (all SQL goes through the port)"
