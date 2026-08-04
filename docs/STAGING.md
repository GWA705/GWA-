# Staging environment setup

A separate, fully isolated copy of the app for testing features and database
migrations against **throwaway data** before anything reaches production. Nothing
here touches real customers, real files, real email, or the real lender.

The code already supports isolated staging **entirely through environment
variables** — no code changes needed. The `staging` branch exists; this is the
one-time Render setup (~15 min of dashboard clicks).

## What makes staging safe (isolation)
- **Its own throwaway database** — separate `DATABASE_URL`. No real data, so it
  doesn't even need to be in Canada.
- **Local storage** — `STORAGE_DRIVER=local`. Staging files are throwaway and
  never mix with production's S3.
- **Log-only email** — leave all `SMTP_*` unset → the app logs "would send"
  instead of emailing anyone.
- **Financeit off** — leave all `FINANCEIT_*` unset → the integration is inert.
- **Its own secrets + seeded admin** — separate from production.
- **A visible "STAGING" banner** — set `NEXT_PUBLIC_APP_ENV=staging`.

## Step 1 — Create a throwaway database
Easiest: Render → **New → Postgres** → name `gwa-staging-db`, Free plan, any
region (US is fine — no real data). Copy its **Internal/External connection
string** once it's Available.
(A free Postgres is perfect here; if it ever expires, just recreate it.)

## Step 2 — Create the staging web service
Render → **New → Web Service** → connect the same GitHub repo →
- **Branch:** `staging`
- **Name:** `gwa-portal-staging`
- **Plan:** Free (it may sleep between uses — fine for testing)
- **Build command:** `npm install && npm run build`
- **Start command:** `sh scripts/start.sh`
- **Health check path:** `/api/health`

## Step 3 — Set the staging environment variables
Set exactly these (and **leave everything else UNSET** for isolation):

| Key | Value |
|---|---|
| `NODE_VERSION` | `20.18.0` |
| `DATABASE_URL` | the `gwa-staging-db` connection string |
| `SESSION_SECRET` | click **Generate** (staging-only) |
| `MASTER_ENCRYPTION_KEY` | click **Generate** (staging-only; data is throwaway) |
| `STORAGE_DRIVER` | `local` |
| `LOCAL_STORAGE_DIR` | `/tmp/storage` |
| `APP_URL` | your staging URL (e.g. `https://gwa-portal-staging.onrender.com`) |
| `NEXT_PUBLIC_APP_ENV` | `staging` |
| `SEED_ADMIN_EMAIL` | a test admin email you'll log in with |
| `SEED_ADMIN_PASSWORD` | a test admin password |

⚠️ **Do NOT set on staging:** `SMTP_*`, `FINANCEIT_*`, `AWS_*`, `S3_*`. Leaving
them unset is what keeps staging from emailing real people, calling the real
lender, or touching production's Canadian file storage.

## Step 4 — Deploy & verify
Save → it builds and runs `scripts/start.sh` (migrations + seed) against the
staging DB. Open the staging URL — you should see the amber **STAGING** banner,
and you log in with the `SEED_ADMIN_*` credentials.

## The workflow once staging exists
1. I build a change on a `feature/<name>` branch.
2. Merge it to **`staging`** → the staging service deploys it.
3. You preview it on the staging URL and approve.
4. I merge to the **production** branch → the live app deploys.
5. Rollback on production is one click if ever needed (see `docs/DEVELOPMENT.md`).

This way every change — especially database migrations — is proven on throwaway
data before it can ever affect a real customer.
