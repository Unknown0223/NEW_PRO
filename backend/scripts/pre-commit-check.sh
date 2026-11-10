#!/usr/bin/env bash
# Pre-commit: tez sifat tekshiruvi (faqat o'zgargan fayllar + fayl hajmi).
# To'liq gate CI'da: typecheck, testlar, lint.
set -euo pipefail
cd "$(dirname "$0")/.."

has() { command -v "$1" >/dev/null 2>&1; }

STAGED_TS=$(git diff --cached --name-only --diff-filter=ACMR -- 'src/**/*.ts' 'scripts/**/*.ts' 'shared/**/*.ts' || true)
STAGED_FE=$(git diff --cached --name-only --diff-filter=ACMR -- '../frontend/**/*.ts' '../frontend/**/*.tsx' || true)

if [ -n "${STAGED_TS}${STAGED_FE}" ]; then
  echo "pre-commit: typecheck (tsc --noEmit)..."
  npx tsc -p tsconfig.json --noEmit
else
  echo "pre-commit: backend fayllari o'zgarmagan — typecheck o'tkazib yuborildi"
fi

# Backend ESLint: faqat o'zgargan fayllar, faqat error'lar (tez).
if [ -n "${STAGED_TS}" ] && [ -x node_modules/.bin/eslint ]; then
  echo "pre-commit: eslint (errors only)..."
  # shellcheck disable=SC2086
  node_modules/.bin/eslint --config eslint.config.mjs --quiet ${STAGED_TS} || {
    echo "pre-commit: eslint error — tuzating yoki 'npm run lint:fix'"
    exit 1
  }
fi

echo "pre-commit: audit max loc..."
npm run audit:max-loc

echo "pre-commit OK"
