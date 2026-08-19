#!/usr/bin/env sh
# Production start script (used by Render). Waits for the database to be ready,
# applies migrations, seeds sample data, then starts the web server. Logs each
# step so failures are easy to diagnose in the service logs.

# Render runs in UTC. This is an Ontario business, so render all dates/times in
# Eastern (handles EST/EDT automatically). Set before the Node server starts so
# every timestamp — audit log, histories, deal times — shows local time.
export TZ="America/Toronto"

echo "[start] Applying database migrations..."
n=0
max=10
until [ "$n" -ge "$max" ]; do
  if npx prisma migrate deploy; then
    echo "[start] Migrations applied successfully."
    break
  fi
  n=$((n + 1))
  echo "[start] Database not ready yet (attempt $n/$max). Waiting 6s..."
  sleep 6
done

if [ "$n" -ge "$max" ]; then
  echo "[start] ERROR: Could not reach the database after $max attempts."
  echo "[start] Check that DATABASE_URL is set and the database is 'Available'."
  exit 1
fi

# Runs after migrations (it needs the AppSetting table) and before the server
# accepts a request. Its job is to stop a misconfigured deploy — above all, a
# changed encryption key — from ever reaching a user. A non-zero exit here
# aborts the deploy and Render keeps serving the previous version.
echo "[start] Running preflight checks..."
if ! npx tsx scripts/preflight.ts; then
  echo "[start] ERROR: Preflight failed. Not starting the web server."
  echo "[start] The previous deploy stays live. See the preflight output above."
  exit 1
fi

echo "[start] Seeding sample data (safe to re-run)..."
npx prisma db seed || echo "[start] Seed skipped (already present or unavailable)."

echo "[start] Starting web server..."
exec npm run start
