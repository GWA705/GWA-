# Backup — action items

Status: ALL COMPLETE (2026-08-09). The AWS account was upgraded to the paid plan
to allow 14-day retention. Kept here as the record + how to verify/redo.

Status legend: [ ] to do · [x] done

## 1. [x] Database backups + point-in-time recovery  (most important)
- **If AWS RDS** (`DATABASE_URL` host contains `amazonaws.com`):
  AWS Console → RDS → Databases → the DB → **Actions → Modify** →
  **Backup → Backup retention period = 14–35 days** → set a quiet backup window →
  **Continue → Apply immediately**.
- **If a Render database:** Render → the Postgres → **Backups / Recovery** tab;
  confirm daily backups + point-in-time recovery and the retention window.

## 2. [x] S3 object versioning
AWS Console → S3 → the documents bucket (value of `S3_BUCKET`) →
**Properties → Bucket Versioning → Edit → Enable → Save**.
(Optional: add a lifecycle rule to expire old noncurrent versions after N days.)

## 3. [x] Escrow the master encryption key  (action required — do first)
Render → `gwa-portal` → **Environment** → reveal **`MASTER_ENCRYPTION_KEY`** →
copy it into a secure password manager / vault. **Without this key, encrypted
personal data cannot be recovered.** Also save `SESSION_SECRET`, `DATABASE_URL`,
and the `S3_*` / `AWS_*` values. Do it on a private screen; never paste the key
into email, notes, or chat.

---

## Also shipped: self-managed weekly database export
A scheduled endpoint now writes a full, encrypted, gzipped JSON export of every
table to the `db-backups/` prefix in the storage bucket — independent insurance
on top of the provider's own backups.

**Scheduled (Render Cron Jobs) — DONE 2026-08-09:**
- `gwa-db-backup-weekly` — `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" .../api/cron/db-backup`, schedule `0 8 * * 0` (weekly). Verified working.
- `gwa-doc-ocr` — same recipe against `/api/cron/doc-ocr`, schedule `*/30 * * * *` (every 30 min). Verified working.
- Both cron jobs carry their own `CRON_SECRET` env var (same value as the web service).

You can also run it on demand with the same authorized request. Restore by
downloading the object from `db-backups/`, decrypting it the same way documents
are decrypted (`lib/backup.readDatabaseBackup(key)` returns the gzipped JSON),
then gunzip.

Note: the archive keeps already-encrypted fields encrypted, so it is not a
plaintext-PII export — recovering those fields still requires the master key
from item 3.
