# Deployment (AWS ca-central-1)

Target region: **ca-central-1 (Montreal)** so all personal data stays in Canada.

## Components

| Concern | Service |
|---|---|
| Compute (Next.js) | Container on AWS App Runner or ECS Fargate (ca-central-1) |
| Database | RDS for PostgreSQL, storage **encryption enabled** (KMS) |
| Documents | S3 bucket, **Block Public Access on**, default **SSE-KMS** |
| Key management | AWS KMS CMK for envelope encryption (`KMS_KEY_ID`) |
| Secrets | AWS Secrets Manager / SSM Parameter Store |
| TLS | ACM certificate + HTTPS load balancer / App Runner TLS |

## Environment variables (production)

Set via Secrets Manager / SSM — never commit real values.

```
DATABASE_URL=postgresql://USER:PASS@<rds-endpoint>:5432/gwa?schema=public&sslmode=require
APP_URL=https://portal.gwa.example
SESSION_SECRET=<openssl rand -base64 48>
KMS_KEY_ID=<arn:aws:kms:ca-central-1:...:key/...>   # enables KMS envelope encryption
AWS_REGION=ca-central-1
STORAGE_DRIVER=s3
S3_BUCKET=gwa-portal-docs
S3_REGION=ca-central-1
# MASTER_ENCRYPTION_KEY is left UNSET in production (KMS is used instead)
```

> **Before enabling `KMS_KEY_ID`:** wire up the KMS `GenerateDataKey`/`Decrypt` calls in
> `wrapDek`/`unwrapDek` (`src/lib/crypto.ts`). They currently throw a clear error so KMS is
> never silently bypassed. Until then, use `MASTER_ENCRYPTION_KEY` for local/staging only.

## Build & release

```bash
npm ci
npm run build            # prisma generate + next build
npx prisma migrate deploy   # apply migrations to RDS
npm start                # or the container CMD
```

Run behind HTTPS. HSTS is emitted automatically when `NODE_ENV=production`.

### IAM (least privilege)

Grant the app role only:
- `kms:GenerateDataKey`, `kms:Decrypt` on the one CMK.
- `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on the docs bucket prefix.
- RDS access via credentials in Secrets Manager.

## End-to-end verification

Run these after deploying to staging (or locally with `npm run dev`):

1. **Auth & routing**
   - `GET /` → redirects to `/login`.
   - `GET /dealer`, `/staff`, `/admin` while logged out → redirect to `/login?next=…`.
   - Sign in as each seeded role → land on the correct portal.
2. **Dealer submission**
   - Create an application with a SIN and a supporting document → it appears in the dealer's
     list as *Submitted*.
3. **Tenant isolation**
   - A second dealer cannot see the first dealer's application (covered by `npm test`; verify
     in the UI too).
4. **Encryption at rest**
   - In the DB, `Application.applicantSinEnc` is a `v1.…` ciphertext token, not the SIN
     (covered by `npm test`; spot-check with a SQL query).
5. **Staff review**
   - As reviewer: open the application, **Reveal** sensitive fields (creates a `PII_DECRYPT`
     audit entry), then Approve → dealer sees *Approved*.
6. **Funding**
   - As dealer: add serial numbers and upload the funding package; the *Submit funding
     package* button unlocks only when required documents are present. Submit → *Funding
     submitted*.
   - As reviewer: *Approve funding* → *Funded*.
7. **Document security**
   - `GET /api/documents/<id>` while logged out → `401`; as a different dealer → `403`.
8. **Audit**
   - `/admin/audit` shows logins, PII reveals, decisions, and document access.

## Operational notes

- Enable automated RDS backups and S3 versioning.
- Ship application logs and the `AuditLog` to a durable, access-controlled store.
- Rotate `SESSION_SECRET` and KMS keys per policy; plan a re-encryption path for field data.
