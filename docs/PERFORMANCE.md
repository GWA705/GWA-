# Performance — why it slowed and how we speed it up

## Root cause
After moving the database to AWS RDS in **ca-central-1 (Canada)** for residency,
the app still runs on **Render in Oregon (US)**. Every database query now makes a
**US ↔ Canada round trip (~60–80 ms each)**. Pages that run several queries
one-after-another multiply that delay. (Prisma pools connections and the service
is always-on, so it's distance — not a config bug or cold starts.)

## Lever 1 — fewer round trips (done / ongoing, stays on Render)
Reduce how many sequential queries each page makes so the latency stops
stacking.

**Done (this branch):**
- **Reviewer deal page** (`staff/applications/[id]`) — the deal, finance-company
  list, and note-template list ran sequentially; now they run **concurrently**
  (`Promise.all`): 3 round trips → 1.
- **Dealer mail detail** — used the receipt upsert's own return value instead of
  a second read-back: 1 fewer round trip per open.

**Next (planned):**
- Parallelize remaining multi-query pages.
- **Cache slow-changing data** (marketplace categories, content sections, app
  settings, announcements) so most page loads don't re-query Canada for them.
- Trim over-fetching; add indexes for any heavy queries.
- Optionally cache the per-request session lookup.

These help a lot but can't beat physics for queries that must run live.

## Lever 2 — the real fix: put the app in Canada, next to the database
Co-locating app + DB in `ca-central-1` drops per-query travel from ~70 ms to
~1 ms — the slowdown essentially disappears, and it completes data residency
(compute *and* data in Canada).

Render has no Canadian region, so this means moving the **web service** to a host
that does. Options, best-fit first:

1. **AWS in ca-central-1** (same account/region as RDS + S3 — fully consolidated):
   - **AWS App Runner** — closest to Render's "push a repo, it builds & runs"
     experience; managed, autoscaling, HTTPS. Easiest AWS path.
   - **AWS Lightsail Containers** — simple, fixed low price.
   - **ECS Fargate** — most control, more setup.
2. **Fly.io, Toronto (`yyz`) region** — very Render-like DX, quick to stand up.

Rough migration outline (a planned project, not a tonight task):
- Containerize or connect the repo to the new host; set the same env vars
  (`DATABASE_URL`, `MASTER_ENCRYPTION_KEY`, `SESSION_SECRET`, S3/AWS keys, SMTP,
  `APP_URL`, etc.).
- Point the RDS security group at the new host's egress IPs (like we did for
  Render).
- Move the `portal.ghsbarrie.ca` custom domain + TLS to the new host.
- Cut over DNS, verify, decommission the Render service.

## Recommended order
1. Ship Lever 1 (query parallelize + caching) — quick, free, keeps Render.
2. Re-measure. If it's good enough for now, stay.
3. When scaling up real dealers (or if it still drags), do Lever 2 — move compute
   to **AWS ca-central-1** for the permanent fix + full Canadian residency.
