#!/usr/bin/env sh
# Production start script (used by Render). Waits for the database to be ready,
# applies migrations, seeds sample data, then starts the web server. Logs each
# step so failures are easy to diagnose in the service logs.

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

echo "[start] Seeding sample data (safe to re-run)..."
npx prisma db seed || echo "[start] Seed skipped (already present or unavailable)."

echo "[start] Starting web server..."
exec npm run start
