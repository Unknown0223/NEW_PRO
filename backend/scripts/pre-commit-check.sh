#!/usr/bin/env bash
# Pre-commit: tez lint/typecheck (backend).
set -euo pipefail
cd "$(dirname "$0")/.."
echo "pre-commit: typecheck (tsc --noEmit via build dry)..."
npx tsc -p tsconfig.json --noEmit
echo "pre-commit: audit max loc..."
npm run audit:max-loc
echo "pre-commit OK"
