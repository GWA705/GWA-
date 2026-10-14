# Scheduled syncs — off GitHub Actions, onto the EB instance

**Why:** the portal runs no in-app scheduler, so three jobs were driven by
GitHub Actions cron workflows. Each run is a ~2-second `curl`, but GitHub bills
every job a **full minute minimum**, so between them they burned **~2,000 Actions
minutes/month** and blew the account's 3,000-minute allowance (which is shared
across *all* repos on the account, including the booking site).

| Job | Cadence | GitHub min/month (1-min floor) |
|---|---|---|
| resolution-email-sync | every 30 min | ~1,440 |
| journal-paid-sync | every 2 h | ~360 |
| zoom-sync | every 2 h | ~360 |

**Fix:** run them as **host cron jobs on the Elastic Beanstalk instance** we
already pay for — `/.platform/hooks/postdeploy/02_install_crons.sh`. Zero GitHub
minutes, no extra cost, same endpoints, same cadence. The env is single-instance
so there's no duplicate firing; Immutable deploys re-install the crontab on every
deploy.

## Rollout (two steps — safe by design)

1. **Deploy the host crons (done in this change).** The postdeploy hook installs
   `/etc/cron.d/gwa-crons` + a runner at `/usr/local/bin/gwa-cron.sh`, installs
   `cronie` if the AMI lacks it, starts `crond`, and runs a one-time smoke test of
   all three endpoints. It is best-effort and **can never fail a deploy**.
   **The GitHub cron workflows stay enabled as a safety net** during this step, so
   even if the host cron doesn't take, the syncs keep running.

2. **Turn off the GitHub crons — only after verifying step 1.** Verify, then
   comment out the `schedule:` block in each of
   `.github/workflows/{resolution-email-sync,journal-paid-sync,zoom-sync}.yml`
   (keep `workflow_dispatch` so they can still be run by hand as a backup). That's
   the point where the ~2,000 minutes/month actually stop.

## How to verify step 1 (after the deploy finishes)

- **EB logs:** Elastic Beanstalk console → Environment → Logs → *Request Logs →
  Last 100 Lines* (or full logs), look for `/var/log/gwa-cron.log`. You should see
  smoke-test lines like `2026-10-14T03:10:00Z resolution-email-sync -> HTTP 200`
  within a minute of the deploy, then a new line every 30 min.
- **HTTP codes:** `200` = good. `401` = the instance's `CRON_SECRET` doesn't match
  (it reads the EB env var, so this should match by construction). `000` = couldn't
  reach the URL.
- Once you see `HTTP 200` lines ticking, tell me and I'll do step 2.

## Notes / future
- If the environment is ever scaled to **multiple instances**, this host cron
  would fire on each one. Add a leader guard or move to **AWS EventBridge
  Scheduler** (API destination → the same endpoints) at that point. EventBridge is
  the more decoupled option if you'd rather not run cron on the app instance at all.
- `CRON_SECRET` is read at run time from the EB environment via
  `get-config environment -k CRON_SECRET` — nothing is hard-coded.
