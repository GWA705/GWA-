# Moving the portal to AWS Canada (ca-central-1)

**Status: planned / ready to execute. Nothing here changes the live Render
service until you run it.**

## The one thing to understand first

Your **data is already in Canada**. RDS PostgreSQL and the S3 document bucket
both live in **`ca-central-1`**. The only thing running in the US is the **app
server** (Render's Oregon region — Render has no Canadian region).

So this is **not a data migration.** It's standing up the *app* in `ca-central-1`
next to Render, pointed at the *same* database and bucket, then flipping DNS.
Because nothing moves, it's a **zero-downtime, parallel-run cutover** with an
instant rollback.

Benefits: kills the US↔Canada round trip on every DB query and every file write
(faster pages + uploads), and closes the last residency gap — right now US
compute processes Canadian PII in transit (a real PIPEDA / Quebec Law 25
consideration for a credit app).

**Effort:** ~1–3 focused days of infra work; ~1 week elapsed with a staging soak.

---

## Target architecture

```
Route 53 (DNS)
   │  (flip A/ALIAS from Render → ALB at cutover)
   ▼
ALB (ca-central-1, HTTPS via ACM cert)
   ▼
ECS Fargate service  ── runs the Next.js container (this repo)
   ├─► RDS PostgreSQL   (ca-central-1)  ← already exists, unchanged
   ├─► S3 gwa-portal-documents (ca-central-1) ← already exists, unchanged
   └─► Secrets Manager  (env vars)
```

Recommended compute: **ECS Fargate + ALB** (the app is already container-shaped:
`scripts/start.sh` runs `prisma migrate deploy` then `npm run start`).
Alternatives at the bottom.

---

## Prerequisites (one-time)

- AWS account access to `ca-central-1` with the RDS instance + S3 bucket.
- A domain you control in Route 53 (or wherever DNS lives).
- Docker installed locally (or use CodeBuild).
- The current **Render env var values** exported (Dashboard → the service →
  Environment). You will copy these into Secrets Manager. See the list below.

---

## Environment variables to carry over

Copy every var the service uses today into **AWS Secrets Manager** (or Parameter
Store) and inject them into the Fargate task. Full list (from `.env.example`):

**Must match Render EXACTLY (or you break existing data/logins):**
- `SESSION_SECRET` — same value = live login sessions survive the cutover (no
  forced logout). A different value logs everyone out.
- `MASTER_ENCRYPTION_KEY` — **critical.** This decrypts SIN / banking / MFA
  secrets in the DB. A wrong/missing value makes existing encrypted data
  unreadable. Copy the exact value.
- `DATABASE_URL` — same RDS connection string.

**Copy as-is:**
`STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION=ca-central-1`, `S3_SSE`,
`S3_KMS_KEY_ID`/`KMS_KEY_ID` (if used), `AWS_REGION` — on Fargate prefer an
**IAM task role** for S3/KMS instead of `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`.
`SMTP_HOST` `SMTP_PORT` `SMTP_SECURE` `SMTP_USER` `SMTP_PASS`,
`EMAIL_FROM` `EMAIL_FROM_NAME` `EMAIL_REPLY_TO`,
`GOOGLE_SERVICE_ACCOUNT_JSON` (or `GOOGLE_APPLICATION_CREDENTIALS`),
`JOURNAL_SHEET_ID` `JOURNAL_SHEET_ID_2024..2027`, `HD_LEADS_SHEET_ID`,
`CRON_SECRET`, `FINANCEIT_*`,
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`,
`VAPID_PUBLIC_KEY` `VAPID_PRIVATE_KEY` `VAPID_SUBJECT` `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`SEED_ADMIN_EMAIL` `SEED_ADMIN_PASSWORD` (harmless — seed is idempotent),
`TZ=America/Toronto`, `NODE_VERSION`/base image Node 20.x.

**Set fresh for AWS:**
- `APP_URL` — to the production domain (keep it the same domain post-cutover).

> `NEXT_PUBLIC_*` vars are baked in at **build time** — set them during the
> `docker build`, not only at runtime.

---

## Build artifact — Dockerfile

Add this `Dockerfile` at the repo root at migration time (Render ignores it —
Render uses `runtime: node`, so committing it does not affect the live service):

```dockerfile
# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
# System libs for sharp/pdf image processing
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* must be present at build time:
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
RUN npm run build

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production TZ=America/Toronto
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
EXPOSE 3000
# start.sh: waits for DB, runs prisma migrate deploy, seeds (idempotent), starts
CMD ["sh", "scripts/start.sh"]
```

- Health check path (already implemented): **`/api/health`** — point the ALB
  target group + ECS health check at it.
- Optional lean image: set `output: 'standalone'` in `next.config` and copy only
  `.next/standalone` + `.next/static` + `public`. Not required; the simple image
  above works. If you switch to standalone, the container start command changes
  to `node server.js` and you must run `prisma migrate deploy` as a separate
  one-off task (see gotchas).

---

## Cutover — step by step (no downtime)

1. **Lower DNS TTL** on the app hostname to 60s, a day ahead, so the final flip
   propagates fast.
2. **Networking:** ensure the RDS security group allows inbound from the new
   Fargate service's security group (same VPC, or peered). S3 is reached over
   the AWS network / a VPC gateway endpoint.
3. **Secrets:** load all env vars into Secrets Manager (above).
4. **Image:** `docker build` (with the `NEXT_PUBLIC_*` build args) and push to
   **ECR** in `ca-central-1`.
5. **Service:** create the ECS Fargate service (1–2 tasks, 1 vCPU / 2 GB to match
   Render's headroom for image/PDF work) behind an **ALB** with an **ACM** TLS
   cert for the domain. Wire env from Secrets Manager; attach an **IAM task role**
   granting `s3:*Object` on the bucket (+ KMS if SSE-KMS).
6. **Smoke test on a temp hostname** (e.g. `aws.yourdomain.ca` or the ALB DNS):
   log in (confirms `SESSION_SECRET` + `MASTER_ENCRYPTION_KEY` decrypt existing
   data), open a deal, **upload a document** (confirms S3 + encryption), check
   **Admin → System health** all green, and load a report (confirms journals).
   Because it shares the live DB, you're testing against real data — avoid
   *writing* test deals, or use an off-hours window.
7. **Freeze scheduled jobs on one side** (see cron gotcha) so both environments
   don't double-fire during the overlap.
8. **Flip DNS** from Render to the ALB. Traffic drains over as TTL expires; both
   serve identical data throughout, so no outage and no data split.
9. **Watch** logs/health for 24–48h with Render still running as rollback.
10. **Decommission Render** once stable (delete the service; keep the RDS/S3 —
    they were never Render's).

---

## Gotchas (read before cutover)

- **`MASTER_ENCRYPTION_KEY` / `SESSION_SECRET` must be identical** to Render, or
  you lose access to encrypted fields / log everyone out. This is the #1 risk.
- **Migrations run on start** (`scripts/start.sh`). With the shared DB, a rolling
  Fargate deploy could run `migrate deploy` from multiple tasks at once —
  Prisma advisory-locks migrations so it's safe, but cleanest is a **one-off
  ECS "migrate" task** before scaling the service, especially if you move to the
  standalone image (whose CMD is `node server.js` and won't run migrations).
- **Cron / scheduled jobs:** the dealer-reminder run is triggered via an HTTP
  route guarded by `CRON_SECRET`. During the parallel window, make sure only
  **one** scheduler (EventBridge or the existing trigger) hits **one** base URL,
  or reminders could double-send. Point the scheduler at the new host only after
  cutover.
- **`TZ=America/Toronto`** must be set (dates render in Eastern) — it's in the
  Dockerfile above and start.sh.
- **Seed is idempotent** (`prisma db seed` is safe to re-run) — no harm if it
  runs on the new host.
- **`NEXT_PUBLIC_*` at build time** — Maps key + VAPID public key must be passed
  as `docker build` args, not just runtime env.
- **CA bundle / outbound**: SMTP (port 587/465) and Google Sheets APIs must be
  reachable from the Fargate subnets (NAT gateway for private subnets).

---

## Rollback

DNS still resolves to Render until you flip it, and Render stays up during the
soak. To roll back: **point DNS back to Render.** Nothing to undo in the DB —
both sides used the same one.

---

## Cost (rough, monthly, USD)

- Fargate 1 vCPU / 2 GB, 1–2 tasks always-on: ~$35–70
- ALB: ~$18 + traffic
- Secrets Manager, ECR, data transfer: a few dollars
- RDS + S3: unchanged (already paying these)

Modestly more than Render's flat plan, in exchange for co-location + full
residency.

---

## Alternatives to Fargate

- **AWS Elastic Beanstalk (Docker platform)** — simpler to stand up, less
  control; same container works. Good middle ground.
- **App Runner** — easiest, but confirm `ca-central-1` availability first
  (historically limited) and VPC connector to reach RDS.
- **Lambda via OpenNext/SST** — serverless, scales to zero, but more re-plumbing
  (streaming, cold starts, the `start.sh` migrate step moves to a deploy hook).
  Only worth it if you want serverless specifically.

Recommended: **Fargate + ALB** — closest to how the app already runs, least
surprise.
