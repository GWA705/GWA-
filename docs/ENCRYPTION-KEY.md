# MASTER_ENCRYPTION_KEY — backup & recovery

**This is the single most important secret in the portal.** Read this before
touching the Render service, the Blueprint, or the database.

## What it is

`MASTER_ENCRYPTION_KEY` is the key that encrypts every sensitive field the portal
stores at rest:

- Social Insurance Numbers (SIN)
- Banking details (void cheque / PAD info)
- Dates of birth
- Home / mailing addresses
- Government photo ID numbers
- MFA (two-factor) secrets

The database holds only the **ciphertext**. This key is the *only* thing that can
turn it back into readable data.

## The rule

- **If this key is lost or changed, all of that data becomes permanently
  unreadable.** The ciphertext is intact but useless.
- **A database backup does NOT protect you.** A backup restores the encrypted
  data, not the key. Backup + lost key = still unrecoverable.
- Therefore the key must be **set once, by hand, and backed up outside Render.**

## How it's configured

In `render.yaml` the variable is `sync: false` (NOT `generateValue: true`), so
Render never auto-generates or overwrites it. It is managed manually in the
Render dashboard:

> Render → the portal service → **Environment** → `MASTER_ENCRYPTION_KEY`

`generateValue: true` was the original setting and was dangerous: it tells Render
"invent a value if this variable is ever missing." On the day a service is first
created that's harmless; every day after, a service recreate / new-environment /
cleared-variable would silently generate a *new* key and orphan all existing data.

## What you must do (once)

1. Open Render → portal service → **Environment**.
2. Confirm `MASTER_ENCRYPTION_KEY` has a value. (It should — Render generated one
   when the service was first created.)
3. **Copy that exact value and store it somewhere safe outside Render** — a
   password manager or secured vault that at least two trusted people can reach.
   Label it clearly (e.g. "GWA Portal — MASTER_ENCRYPTION_KEY — do not change").
4. Never rotate or regenerate it for the existing database (see below).

## Do / Don't

- ✅ Keep the current value stable for the life of the current database.
- ✅ Back it up in at least one place outside Render.
- ✅ If you ever migrate to a genuinely **new, empty** database, generate a fresh
  key: `openssl rand -base64 32`.
- ❌ Do **not** click "Generate" / regenerate the variable on the live service.
- ❌ Do **not** recreate the service or spin up a new environment from the
  Blueprint without first setting this variable to the backed-up value.
- ❌ Do **not** commit the key value to git or paste it into chat, email, or
  tickets.

## If it's already lost

If the key was changed/lost and the data no longer decrypts, there is no
technical recovery — the affected records must be re-collected from customers.
Contact whoever manages the database before taking any further action, and do not
"try a new key," which only makes diagnosis harder.

## Related

- `render.yaml` — the `sync: false` setting and inline comment.
- `docs/SECURITY-REMEDIATION.md` — overall assessment status.
- `src/lib/crypto.ts` — the envelope-encryption implementation that uses this key.
