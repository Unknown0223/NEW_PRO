#!/bin/sh
set -e

# Default: Asia/Tashkent (UTC+5) — Railway/container UTC bo‘lsa ham
export TZ="${TZ:-Asia/Tashkent}"

echo "[start] prisma migrate deploy..."
npx prisma migrate deploy

echo "[start] background worker..."
node dist/src/worker/index.js &
WORKER_PID=$!

cleanup() {
  echo "[start] shutdown worker pid=$WORKER_PID"
  kill -TERM "$WORKER_PID" 2>/dev/null || true
  wait "$WORKER_PID" 2>/dev/null || true
}
trap cleanup TERM INT

echo "[start] API server..."
node dist/src/index.js &
API_PID=$!

wait "$API_PID"
EXIT=$?
cleanup
exit "$EXIT"
