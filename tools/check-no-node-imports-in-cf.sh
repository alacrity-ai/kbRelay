#!/usr/bin/env bash
# Boundary guard (v0.12.0): Node/self-host-only imports (@libsql/*, @whatwg-node/*,
# node:*) may appear ONLY in runtime/node/**. The CF entrypoint and shared core
# must not import them (they'd break the Worker bundle). Matches import/require
# statements only — not prose in comments. Test files (*.test.ts) are exempt:
# they run under vitest/node and are never part of the Worker bundle.
set -euo pipefail
hits=$(grep -rnE "(from|import|require\() *['\"](@libsql/|@whatwg-node/|node:)" apps/api/src 2>/dev/null \
  | grep -vE "src/runtime/node/|\.test\.ts:" || true)
if [ -n "$hits" ]; then
  echo "FAIL check-no-node-imports-in-cf: Node-only imports leaked into CF/shared code:"; echo "$hits"; exit 1
fi
echo "ok: no Node-only imports in CF/shared code"
