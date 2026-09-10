# AWS migration — live progress & facts

Working record for the in-flight move of the app server from Render (Oregon) to
AWS **ca-central-1**, co-located with the RDS database + S3 bucket to kill the
US↔Canada round trip. The full plan is in `docs/AWS-MIGRATION.md`; this file is
the running state + the account-specific facts we've gathered.

> **SECURITY:** never commit secret values here (access keys, DB password,
> `MASTER_ENCRYPTION_KEY`, `SESSION_SECRET`, SMTP pass, Google JSON). This file
> records only non-secret identifiers and *where* each secret lives.

_Last updated: 2026-09-09._

## Account & network facts (gathered)

| Thing | Value |
|---|---|
| AWS account | **863478708936** (GWA705) |
| Region | **ca-central-1** (Canada Central) |
| VPC | **vpc-0642df2515eee5455** — the **default VPC**, CIDR `172.31.0.0/16` (public subnets + internet gateway already present) |
| RDS instance | **gwa-portal-db** (AZ ca-central-1d) |
| DB name / user / port | `gwa` / `gwa_admin` / `5432` |
| RDS security group | **gwa-rds-sg** = **sg-0d627cbf716b45316** |
| RDS SG inbound (today) | `74.220.56.0/24` + `74.220.48.0/24` (Render Oregon egress — how the US app reaches it now) **+ `sg-0ce5aadbd7e12375a` (EB app SG) + `52.60.67.45/32` (EB EIP)** on 5432, added 2026-09-09 so the AWS app can reach the DB. Confirmed: EB app now boots + serves the login page (proves DB reachable). |
| RDS IAM auth | Disabled |
| S3 bucket | (already in ca-central-1 — confirm name from Render env `S3_BUCKET`) |
| ECR image repo | **863478708936.dkr.ecr.ca-central-1.amazonaws.com/gwa-portal** |

## To be filled in as we go

| Thing | Value |
|---|---|
| CI push IAM user | `github-ecr-push` (ECR PowerUser). Keys → **GitHub Actions secrets**, not here. |
| GitHub Actions secrets set | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (+ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for the build) — _pending_ |
| Runtime service | **Elastic Beanstalk** env `Gwa-portal-env` (ID `e-bbrkucgda3`), Docker on AL2023, single instance **t3.small** x86_64, default VPC public subnets. Instance role `aws-elasticbeanstalk-ec2-role` (added `AmazonEC2ContainerRegistryReadOnly` to fix ECR pull). |
| App security group (EB) | **sg-0ce5aadbd7e12375a** → add to `sg-0d627cbf716b45316` inbound on 5432 (PostgreSQL) |
| EB static IP (EIP) | 52.60.67.45 |
| Temp test URL | http://Gwa-portal-env.eba-x7adqt2q.ca-central-1.elasticbeanstalk.com (HTTP; login needs HTTPS → add TLS before login test) |
| Env vars loaded (core) | DATABASE_URL, MASTER_ENCRYPTION_KEY, SESSION_SECRET, STORAGE_DRIVER=s3, S3_BUCKET, S3_REGION, AWS keys, TZ. **Still to add:** SMTP_*, EMAIL_*, CRON_SECRET, FINANCEIT_*, ANTHROPIC_API_KEY, DEEPL_API_KEY, VAPID_*, JOURNAL_SHEET_ID*, HD_LEADS_SHEET_ID, APP_URL, and GOOGLE_SERVICE_ACCOUNT_JSON (big — via Secrets Manager/file, not EB env). |
| ACM TLS cert | **Issued** for `portal.ghsbarrie.ca` in **us-east-1** (required for CloudFront). ARN `arn:aws:acm:us-east-1:863478708936:certificate/ca4f24d9-14d5-4fd7-acbc-3dc1fb5195c3`. DNS-validated via a GoDaddy CNAME. |
| CloudFront distribution | **gwa-portal** (Free plan), ID **E163FPGPE2W8Z3**, domain **`d14c1520tin554.cloudfront.net`**. Origin = EB URL over **HTTP only** (port 80); viewer = **Redirect HTTP→HTTPS**; cache policy **CachingDisabled** + origin request policy **AllViewer** (dynamic app pass-through). Alternate domain **portal.ghsbarrie.ca** + the ACM cert attached. Created 2026-09-09. |
| Domain / DNS host | **GoDaddy** (managed by Sean). `portal.ghsbarrie.ca` currently `CNAME → gwa-portal.onrender.com` (Render — untouched). Cutover = repoint that CNAME → `d14c1520tin554.cloudfront.net` after login test passes. |

## Env vars to carry into AWS (from the Render `gwa-portal` service)

Copied into **AWS Secrets Manager** (or the EB environment), NOT into this repo.
Full annotated list in `docs/AWS-MIGRATION.md`. The two that MUST match Render
exactly or you break data/logins:

- **`MASTER_ENCRYPTION_KEY`** — decrypts SIN/banking/MFA. Wrong value = existing
  encrypted data unreadable. **#1 risk.**
- **`SESSION_SECRET`** — same value keeps everyone logged in across the cutover.

Plus (copy as-is): `DATABASE_URL`, `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`,
`S3_SSE`, SMTP_*, `EMAIL_*`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `JOURNAL_SHEET_ID*`,
`HD_LEADS_SHEET_ID`, `CRON_SECRET`, `FINANCEIT_*`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`,
VAPID_* , `SEED_ADMIN_*`, `TZ=America/Toronto`. Set fresh: `APP_URL`.

## Progress checklist

- [x] **Step 1 — gather facts** (account, region, VPC, RDS, security group). Done.
- [x] Dockerfile + .dockerignore committed (Render unaffected).
- [x] **Step 2a — ECR repo** `gwa-portal` created.
- [x] **Step 2b — automated build** done. IAM user `github-ecr-push` (keys in GitHub secrets), workflow `.github/workflows/build-ecr.yml` builds & pushes on every branch push. First image live: `…/gwa-portal:latest`. `Dockerrun.aws.json` (root) points Elastic Beanstalk at that image.
- [x] **Step 3 — runtime service** (Elastic Beanstalk, Docker platform, deploy via `Dockerrun.aws.json`; default VPC + public subnet + public IP so it reaches RDS in-VPC AND the internet with no NAT; instance role needs `AmazonEC2ContainerRegistryReadOnly` to pull the image; load all env vars incl. the critical `MASTER_ENCRYPTION_KEY`/`SESSION_SECRET`). **App boots + serves the login page.**
    - `NEXT_PUBLIC_I18N_ENABLED=1` now baked into the image (Dockerfile ARG + CI build-arg) — the EN/FR toggle is back. **Still to bake:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (add as GitHub secrets → they flow through the existing build-args). Only affects client Google Maps + web-push; the Leads map uses OpenStreetMap so it's unaffected. Non-blocking for cutover.
- [x] Add EB app's security group + EIP to `sg-0d627cbf716b45316` inbound (5432). Done 2026-09-09 — fixed the P1001 DB-unreachable crash loop / 502.
- [x] **HTTPS** — ACM cert (us-east-1) issued for `portal.ghsbarrie.ca`; **CloudFront** distribution `E163FPGPE2W8Z3` (`d14c1520tin554.cloudfront.net`) in front of EB, cert + alt-domain attached. Done 2026-09-09.
- [x] **Login works end-to-end** over CloudFront https (`https://d14c1520tin554.cloudfront.net`) 2026-09-09 — proves CloudFront → EB (Canada) → RDS. Note: email lowercased/trimmed at login, so email case is not a factor.
- [x] **Step 4 — full smoke test PASSED** over CloudFront https (2026-09-10). Dashboard, deals, marketplace, Leads, Reports, Google Sheets (leads/journals green on System health), AI assistant, EN/FR toggle all working. **The whole portal runs on AWS.**
- [x] **Loaded remaining EB env vars** (2026-09-10): `GOOGLE_SERVICE_ACCOUNT_JSON` (inline — fits under the EB 4KB env cap alongside the rest), `HD_LEADS_SHEET_ID`, `JOURNAL_SHEET_ID` + `_2024/_2025/_2026/_2027`, `ANTHROPIC_API_KEY`, `DEEPL_API_KEY`, `GOOGLE_MAPS_API_KEY`, `CRON_SECRET`. (SMTP_*/APP_URL loaded earlier.) Google service account authenticates. Note: `GOOGLE_TRANSLATE_API_KEY` is a dormant translation *backup* — not set on Render either, DeepL is primary; nothing to migrate.
- [x] **CDN login fix** — `createSession` now emits a single Set-Cookie (multiple Set-Cookie on the server-action redirect were being dropped behind CloudFront, bouncing users to /login). **AI health check** added to System health (`pingAi()` → Anthropic `/v1/models`).
- [ ] **Optional follow-up (non-blocking):** add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` as GitHub secrets + rebuild, to light up client Google Maps + web-push.
- [ ] After cutover: the Render **cron schedulers stay as-is** — they call `portal.ghsbarrie.ca` on a timer, so they hit AWS automatically once DNS flips (EB has `CRON_SECRET`). Same for the HD remittance webhook. Rebuild them on AWS only when Render is retired.
- [x] **Step 5 — DNS FLIPPED (2026-09-10).** GoDaddy `portal` CNAME → `d14c1520tin554.cloudfront.net` (TTL 30 min). Verified from outside: `portal.ghsbarrie.ca` resolves to CloudFront and responds `via: … (CloudFront)` over https. **portal.ghsbarrie.ca now serves from AWS.**
- [ ] **Soak 24–48h** with Render still running as instant rollback (to roll back: point the `portal` CNAME back to `gwa-portal.onrender.com`). Watch: logins, a real deal submission, email delivery, the nightly crons firing against the new host.
- [ ] **Decommission** once soaked: retire the Render **web** service (`gwa-portal`); keep RDS + S3. Decide crons — leave the Render cron schedulers (they hit AWS via the domain) or rebuild on AWS EventBridge. Keep the ACM cert + its GoDaddy validation CNAME (auto-renewal).
