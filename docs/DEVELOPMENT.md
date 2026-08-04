# Development & deployment workflow

How to build changes safely without affecting the live app at
`portal.ghsbarrie.ca`.

## The idea

Separate **building** from **live**:

- **Production branch** — `claude/pci-credit-application-portal-vi7d6r`. This is
  the only branch Render auto-deploys. Only tested, ready code lands here.
- **Feature branches** — `feature/<short-name>`, branched off production. This
  is where new work happens. **Pushing a feature branch does NOT deploy** and
  cannot affect the live app.

New work is built on a feature branch, verified, then merged into the production
branch — only then does it go live.

## Building a change

1. Start from the latest production branch and cut a feature branch:
   ```
   git checkout claude/pci-credit-application-portal-vi7d6r
   git pull
   git checkout -b feature/<short-name>
   ```
2. Build and commit on the feature branch. Push it freely — the live app is
   untouched.
3. Verify before merging:
   ```
   npx tsc --noEmit      # type check
   npm run build         # production build (also runs lint)
   npm test              # if/when tests exist for the area
   ```
4. When it's ready, merge the feature branch into the production branch and push.
   Render then auto-deploys it.

## Safety nets

- **Zero-downtime deploys** (Standard plan): Render builds the new version and
  passes the `/api/health` check *before* switching traffic to it. The current
  version keeps serving the whole time the new one builds — users never see a
  gap.
- **One-click rollback**: Render → `gwa-portal` → **Deploys** → pick the last
  known-good deploy → **Rollback**. Reverts instantly if a release misbehaves.
- **Database migrations run on deploy** (`scripts/start.sh` → `prisma migrate
  deploy`). Keep them **backward-compatible / additive**: add columns and tables;
  avoid dropping or renaming in the same release as code that still needs the old
  shape. That way the old version keeps working during the zero-downtime swap.
  Do destructive changes in two steps across two releases.

## Rolling back a bad deploy

1. Render → `gwa-portal` → **Deploys**.
2. Find the previous **Live** deploy → **⋯ → Rollback to this deploy**.
3. If the bad release included a *destructive* migration, a code rollback alone
   won't restore dropped data — restore the database from an RDS snapshot. This
   is exactly why migrations stay additive.

## Staging (optional, recommended before heavy real-customer use)

For a fuller safety net, stand up a second Render web service + its own small
database that deploys from a `staging` branch. Test the full app **and its
migrations** there against throwaway data, then merge `staging` → production.
Nothing experimental ever touches real customer data. (Ask and this can be set
up.)

## Notes

- The Render service deploys from its **own Git connection** (Settings → Build &
  Deploy → branch), independent of any Blueprint. The Blueprint was disconnected;
  it does not affect deploys.
- Files live in AWS S3 (ca-central-1); the database is AWS RDS (ca-central-1).
  Neither is affected by an app deploy.
