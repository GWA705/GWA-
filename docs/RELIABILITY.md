# GWA Dealer Portal — Reliability & Ops Hardening

How we keep the portal up, how deploys stay safe, and the checklist to audit that
everything is in place. Born out of the **2026-10-02 outage** (below). Read this
with `BUILD-FACTS.md` (architecture) and `CHANGELOG.md` (what shipped).

---

## 1. What happened on 2026-10-02 (postmortem)

- **Symptom:** mid-afternoon the portal went to a load screen then blank, then
  fully down. Elastic Beanstalk health showed **"No Data — none of the instances
  are sending data."**
- **Root cause:** the environment runs a **single small instance** (t3.small,
  2 GB RAM, 30 GB disk). We deployed ~7 times that day; each deploy pulls a new
  Docker image and the old ones **piled up and filled the disk** (and/or memory
  pressure), until the instance wedged and its health agent stopped reporting.
- **Why it hurt so long:** **instance auto-replacement was off**, so nothing
  healed the wedged box automatically. A manual **Rebuild environment** then
  failed because the environment's security group couldn't be deleted — the
  **database's firewall referenced it** — leaving the site with **zero instances**
  until we removed that firewall link, finished the rebuild, and re-added it.
- **Not the cause:** the day's code changes. A bad deploy fails in seconds; this
  degraded ~3 hours after the last deploy. It was infrastructure, not the app.

**Lesson:** the single instance had no headroom and no self-healing, and a manual
rebuild is a trap (it can delete the shared security group). The fixes below make
both the trigger and the painful recovery unnecessary.

---

## 2. Fixes now in the repo (apply on the next deploy)

These are version-controlled so they're reproducible, not click-ops.

| Fix | File | What it does |
|---|---|---|
| **Immutable deploys** | `.ebextensions/01_resilience.config` | Each deploy launches a **new** instance that must pass the health check **before** any traffic swap. A bad build is **auto-rolled-back** with the old instance still serving — a broken deploy can no longer take the site down. Also gives a **fresh disk every deploy**, so images can't pile up. |
| **Disk cleanup hook** | `.platform/hooks/postdeploy/01_docker_prune.sh` | Prunes old Docker images/build cache after a deploy. Belt-and-suspenders now that deploys are immutable. |
| **App-aware health check** | `.ebextensions/01_resilience.config` | EB judges health by polling **`/api/health`** (a lightweight liveness probe, no DB), not just an open port. Gates the immutable swap. |
| **Health-change email alert** | `.ebextensions/01_resilience.config` | EB emails **sean@ghsbarrie.ca** the instant environment health degrades or recovers. ⚠ **One-time action:** AWS sends a "Confirm subscription" email — **click it** or alerts won't arrive. |
| **Health-gated CI deploy** | `.github/workflows/build-ecr.yml` | `wait_for_deployment: true` — the GitHub Action now **waits for EB to report healthy** and turns **red** (with an email) if a deploy fails, instead of reporting success while the site is down. |
| **Keep patches flowing** | `.ebextensions/01_resilience.config` | Managed platform updates on, applied in a quiet Sunday window. |

---

## 3. Console actions still to do (only you can do these)

Checklist — none are urgent after the repo fixes deploy, but each adds a layer:

- [x] **SNS alert email — ✅ confirmed 2026-10-04 (Sean).** The AWS "Confirm
      subscription" link for sean@ghsbarrie.ca was clicked, so EB health-change
      alerts now deliver.
- [x] **Instance headroom — ✅ 2026-10-04 (Sean).** Bumped t3.small →
      **t3.medium** (2 → 4 GB RAM) and root volume 30 → **50 GB** gp3, via EB →
      Configuration → Capacity. Costs **~$19/mo more** (mostly the instance).
      **💡 Cost note / revisit:** this was sized for heavy build-and-deploy days.
      Once active development slows, we can drop back to **t3.small** on the same
      screen to save ~$17/mo — immutable deploys already give a fresh disk every
      time, so t3.small is safe at a low change-pace. Revisit when updates slow.
- [x] **RDS backups — ✅ confirmed 2026-10-04.** `gwa-portal-db` automated
      backups **Enabled, 16-day retention** (point-in-time restore; last restore
      point Oct 3 21:19), nightly backup window 06:24–06:54 UTC, copy-tags-to-
      snapshots on, backups stored in ca-central-1. Manual `gwa-before-rebuild`
      snapshot from the outage is retained. No change needed. *(Note: RDS shows a
      pending `system-update` OS patch — low priority, let it apply in the
      maintenance window.)*
- [ ] **Decide on RDS Multi-AZ.** Off today (single-AZ, cheaper). Multi-AZ adds
      automatic database failover for ~2× the DB cost — worth it once revenue
      depends on uptime. Not required day one.
- [x] **External uptime monitor — ✅ live 2026-10-04 (Sean).** UptimeRobot
      account GWA705 watches `portal.ghsbarrie.ca`, HTTP, **5-min interval**,
      reporting 100% up. Watches from outside AWS = the best "know before
      customers do" net. *Tune-ups:* point the monitor at `/api/health` (cleaner
      liveness check than the homepage); add email + the UptimeRobot mobile app
      as alert contacts, and optionally an SMS contact (25 free credits).
- [ ] **(Optional) CloudWatch alarms** on disk-used % and memory, emailing the
      same inbox, for early warning before health goes red.

---

## 4. The database firewall trap (so a rebuild never bites again)

The app (Elastic Beanstalk) reaches the database because **`gwa-rds-sg`
(sg-0d627cbf716b45316)** has an inbound PostgreSQL rule allowing the app's
security group. On 2026-10-02 a Rebuild couldn't delete the app SG while that
rule referenced it. With **immutable deploys + auto-healing, you should never need
Rebuild again.** If a rebuild is ever truly required: first take an RDS snapshot,
then remove the `gwa-rds-sg` inbound rule that points at the app SG, rebuild, and
re-add a rule pointing at the **new** app SG.

> Hardening idea (not yet done): give the instances a **dedicated, stable
> security group** (via `.ebextensions`) for DB access that EB does not recreate,
> so a rebuild never breaks DB connectivity. Revisit if we ever add a load
> balancer / second instance.

---

## 5. How we deploy (the safe path, going forward)

1. Push to the production branch → GitHub Actions builds the image, pushes to
   ECR, and deploys to EB **immutably**.
2. EB launches a new instance, waits for `/api/health` to pass, then swaps.
3. The Action **waits and goes red** if the deploy isn't healthy; EB emails on
   any health change.
4. A failed deploy **auto-rolls-back** — the live site is never left broken.

Keep deploys batched where practical (fewer, validated pushes beat many), and run
the local checks before pushing: `npx tsc --noEmit`, `npx vitest run`,
`npx next build`.

---

*Maintained alongside the codebase. Update this file when the environment's
capacity, deploy policy, backups, or alerting change.*
