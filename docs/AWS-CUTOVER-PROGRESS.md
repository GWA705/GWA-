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
| RDS SG inbound (today) | `74.220.56.0/24` + `74.220.48.0/24` (Render Oregon egress — how the US app reaches it now) |
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
| ACM TLS cert | _tbd_ |
| Domain / DNS host | _tbd_ (portal.ghsbarrie.ca — where is DNS managed?) |

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
- [ ] **Step 3 — runtime service** (Elastic Beanstalk, Docker platform, deploy via `Dockerrun.aws.json`; default VPC + public subnet + public IP so it reaches RDS in-VPC AND the internet with no NAT; instance role needs `AmazonEC2ContainerRegistryReadOnly` to pull the image; load all env vars incl. the critical `MASTER_ENCRYPTION_KEY`/`SESSION_SECRET`).
    - NEXT_PUBLIC build secrets not yet set → Maps/push disabled in the current image until `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are added to GitHub and the image rebuilt.
- [ ] Add EB app's security group to `sg-0d627cbf716b45316` inbound (5432).
- [ ] **Step 4 — smoke test** on temp URL (login, open a deal, upload a doc, System health).
- [ ] Freeze scheduled jobs on one side; point cron/remittance webhook at the new host after cutover.
- [ ] **Step 5 — flip DNS**, soak 24–48h with Render as rollback, then decommission Render (keep RDS + S3).
