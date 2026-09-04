# Rollback — revert the site to the last working version

If a new version of the portal breaks or misbehaves, you can put the last good
version back in about two minutes. There is **no custom button to build** —
Render keeps every previous deploy and can roll back to it.

## Fast path — Render one-click rollback (the "backup button")
1. Render dashboard → the **`gwa-portal`** web service.
2. Open the **Deploys** tab.
3. Find the last deploy that was healthy (green **Live**) — usually the one
   before the one that broke.
4. Click its **⋯ menu → "Rollback to this deploy."**
5. Render re-serves that exact build. Wait for **Live** (~1–2 min). Fixed.

This changes nothing in the database or uploaded files — it only swaps the app
code back.

## Make the fix stick (important — the branch auto-deploys)
The site redeploys automatically on every push to
`claude/pci-credit-application-portal-vi7d6r`. So a Render rollback is temporary:
the next push redeploys the newest code (possibly the broken one). To make it
permanent, do ONE of:

- **Revert the bad change in git** (preferred): `git revert <bad-commit>` and
  push — the branch HEAD becomes the good version, and auto-deploy ships it.
- **Pause auto-deploy** while stabilizing: Render → service → **Settings →
  Auto-Deploy → Off**. Turn it back on once the branch is healthy again.

## Code vs. data — two different levers
- **A bad version / app bug** → Render Rollback or a git revert (this page). No
  data restore needed.
- **Corrupted data or a deleted file** → the AWS backups (already set up, see
  `BACKUP-ACTION-ITEMS.md`): RDS **point-in-time recovery** (14–35 day
  retention), **S3 object versioning** for uploaded documents, and the weekly
  encrypted DB export in the `db-backups/` bucket prefix.
- Migrations are **additive / forward-only**, so older app code runs fine
  against the newer database schema — a code rollback almost never needs a DB
  restore. (Only a deliberately schema-breaking migration would; those are
  avoided.)

## Why not an in-app "Revert" button
An in-app button that redeploys production would need a Render API token stored
in the app and would let any admin roll back the whole site — more risk for no
gain over Render's native rollback, which already has an audit trail. Use the
Render dashboard.

## Quick checklist when something looks wrong after a deploy
1. Is it the **code** or the **data**? (A visual/logic bug = code. Missing or
   wrong records = data.)
2. Code → **Render → Deploys → Rollback** to the last Live deploy.
3. Then **git revert** the bad commit and push (so it doesn't redeploy).
4. Data → RDS point-in-time restore / S3 version restore (see
   `BACKUP-ACTION-ITEMS.md`).
