#!/usr/bin/env bash
# Install host cron jobs that drive the portal's scheduled syncs, replacing the
# GitHub Actions cron workflows. Those workflows ran tiny (~2 second) curls on a
# schedule, but GitHub bills every job a *full minute minimum*, so the three
# crons burned ~2,000 Actions minutes/month between them and blew the 3,000-min
# account allowance. Running them here costs nothing extra (the EB instance is
# already up) and uses zero GitHub minutes.
#
# This environment is SINGLE-INSTANCE (see docs/RELIABILITY.md), so exactly one
# box runs these — no duplicate firing. With Immutable deploys each deploy is a
# fresh instance, so this hook re-installs the crontab every deploy.
#
# Mirrors the old GitHub cadences:
#   resolution-email-sync  every 30 min
#   journal-paid-sync      every 2 h (on the hour)
#   zoom-sync              every 2 h (on the hour)
#
# Best-effort throughout: it must NEVER fail a deploy (no `set -e`; every risky
# step falls back to `|| true`, and the script always exits 0). If anything here
# doesn't take, the GitHub cron workflows are still in place as a safety net
# until they're turned off — so a hiccup here can't silently stop the syncs.
#
# Verify after deploy: /var/log/gwa-cron.log shows a line per run (and three
# smoke-test lines written at the end of this hook).
set -u

# The runner script each cron line calls. Single-quoted heredoc => written
# verbatim; it re-reads CRON_SECRET at run time so it always has the current one.
cat > /usr/local/bin/gwa-cron.sh <<'RUNNER'
#!/usr/bin/env bash
set -u
endpoint="${1:-}"
[ -n "$endpoint" ] || exit 0
secret="$(/opt/elasticbeanstalk/bin/get-config environment -k CRON_SECRET 2>/dev/null || true)"
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  "https://portal.ghsbarrie.ca/api/cron/${endpoint}" \
  -H "Authorization: Bearer ${secret}" \
  --retry 2 --max-time 120 || echo 000)
echo "$(date -u +%FT%TZ) ${endpoint} -> HTTP ${code}" >> /var/log/gwa-cron.log 2>&1
RUNNER
chmod +x /usr/local/bin/gwa-cron.sh || true

# The schedules (UTC). /etc/cron.d entries need the user field (root).
cat > /etc/cron.d/gwa-crons <<'CRON'
# GWA portal scheduled syncs — installed by .platform/hooks/postdeploy.
# Replaces the GitHub Actions cron workflows (zero GitHub minutes).
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
*/30 * * * * root /usr/local/bin/gwa-cron.sh resolution-email-sync
0 */2 * * * root /usr/local/bin/gwa-cron.sh journal-paid-sync
0 */2 * * * root /usr/local/bin/gwa-cron.sh zoom-sync
CRON
chmod 0644 /etc/cron.d/gwa-crons || true

# Make sure cron is installed and running. Amazon Linux 2023 minimal images
# don't ship cron by default, so install cronie if it's missing (AL2023 uses
# dnf, AL2 uses yum). All best-effort.
command -v crond >/dev/null 2>&1 || dnf -y install cronie >/dev/null 2>&1 || yum -y install cronie >/dev/null 2>&1 || true
systemctl enable --now crond >/dev/null 2>&1 || service crond restart >/dev/null 2>&1 || true

# One-time smoke test so /var/log/gwa-cron.log shows results right after deploy
# (proves the runner + secret + endpoints work without waiting for the schedule).
/usr/local/bin/gwa-cron.sh resolution-email-sync || true
/usr/local/bin/gwa-cron.sh journal-paid-sync || true
/usr/local/bin/gwa-cron.sh zoom-sync || true

exit 0
