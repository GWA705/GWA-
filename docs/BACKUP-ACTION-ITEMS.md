# Backup — outstanding action items

Three one-time safeguards to enable in the AWS / Render dashboards. They can't be
done in code (they're account settings), so they're tracked here. Full recovery
procedures live in the Backup & Recovery Runbook.

Status legend: [ ] to do · [x] done

## 1. [ ] Database backups + point-in-time recovery  (most important)
- **If AWS RDS** (`DATABASE_URL` host contains `amazonaws.com`):
  AWS Console → RDS → Databases → the DB → **Actions → Modify** →
  **Backup → Backup retention period = 14–35 days** → set a quiet backup window →
  **Continue → Apply immediately**.
- **If a Render database:** Render → the Postgres → **Backups / Recovery** tab;
  confirm daily backups + point-in-time recovery and the retention window.

## 2. [ ] S3 object versioning
AWS Console → S3 → the documents bucket (value of `S3_BUCKET`) →
**Properties → Bucket Versioning → Edit → Enable → Save**.
(Optional: add a lifecycle rule to expire old noncurrent versions after N days.)

## 3. [ ] Escrow the master encryption key  (action required — do first)
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

**To schedule it (Render Cron Job):**
- Command/URL: `GET https://portal.ghsbarrie.ca/api/cron/db-backup`
- Header: `Authorization: Bearer <CRON_SECRET>`  (same secret the other crons use)
- Schedule: weekly, e.g. `0 8 * * 0` (Sundays 08:00 UTC).

You can also run it on demand with the same authorized request. Restore by
downloading the object from `db-backups/`, decrypting it the same way documents
are decrypted (`lib/backup.readDatabaseBackup(key)` returns the gzipped JSON),
then gunzip.

Note: the archive keeps already-encrypted fields encrypted, so it is not a
plaintext-PII export — recovering those fields still requires the master key
from item 3.
