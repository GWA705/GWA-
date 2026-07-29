# Persistent document storage (Amazon S3)

The portal encrypts every uploaded file (application/funding documents,
announcement images, content attachments) and stores it in object storage.
For anything other than local development you must use **S3**, because
local-disk storage is wiped on redeploy and does not work at all on
serverless hosts like **Vercel**.

Files are **application-encrypted (AES-256-GCM) before they ever reach S3**,
and are only served back through an authenticated, access-controlled route —
there are no public URLs. S3's own encryption is a second layer on top.

Recommended: **AWS S3 in `ca-central-1` (Montreal)** to keep personal
information in Canada (PIPEDA / Quebec Law 25).

---

## One-time AWS setup (~10 minutes)

### 1. Create the bucket
- AWS Console → **S3** → **Create bucket**.
- Name: e.g. `gwa-portal-documents` (must be globally unique).
- Region: **Canada (Central) ca-central-1**.
- **Block ALL public access: leave ON** (the app serves files itself).
- Default encryption: **SSE-S3 (Amazon S3 managed keys)** — the default.
- Create.

### 2. Create a least-privilege user for the app
- AWS Console → **IAM** → **Users** → **Create user** (e.g. `gwa-portal-app`).
- Do **not** give it console access — programmatic only.
- Attach an inline policy (replace the bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::gwa-portal-documents/*"
    }
  ]
}
```

- After creating the user → **Security credentials** → **Create access key**
  (use case: "Application running outside AWS"). Copy the **Access key ID**
  and **Secret access key** — you only see the secret once.

### 3. Set environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
|---|---|
| `STORAGE_DRIVER` | `s3` |
| `S3_BUCKET` | `gwa-portal-documents` |
| `S3_REGION` | `ca-central-1` |
| `S3_SSE` | `AES256` |
| `AWS_ACCESS_KEY_ID` | *(from step 2)* |
| `AWS_SECRET_ACCESS_KEY` | *(from step 2)* |

Also make sure the app's other secrets are set the same way:
`DATABASE_URL`, `SESSION_SECRET`, `MASTER_ENCRYPTION_KEY`, `APP_URL`.

> ⚠️ **`MASTER_ENCRYPTION_KEY` must stay the same forever.** It's the key that
> decrypts every stored file. If it changes, previously uploaded files can't be
> decrypted. Keep a secure backup of it.

### 4. Redeploy
Trigger a redeploy so the new environment variables take effect. Upload a
document on a deal, then re-open it and confirm it downloads. Done — uploads
now persist.

---

## Notes & alternatives
- **Credentials on AWS itself** (e.g. EC2/ECS with an IAM role): leave
  `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` blank; the role is used
  automatically.
- **KMS encryption** instead of SSE-S3: set `S3_SSE=aws:kms` and optionally
  `S3_KMS_KEY_ID=<cmk-arn>` (adds KMS cost).
- **Cloudflare R2 / MinIO / other S3-compatible**: also set `S3_ENDPOINT` to the
  service endpoint (keep `S3_FORCE_PATH_STYLE=true`) plus its access keys. Note
  R2's data location is not guaranteed Canadian — prefer AWS ca-central-1 for
  residency.
- **Cost**: storing scanned PDFs/photos is pennies per GB per month; well within
  a small operation's budget.
- **Migrating existing local files**: anything uploaded while on the local
  driver isn't in S3. Re-upload those documents after switching (there won't be
  many, since local files don't survive redeploys anyway).
