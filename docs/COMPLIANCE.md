# Compliance & Security Posture

This document explains how the GWA Credit Portal is built to support Canadian privacy
compliance, and — importantly — what it does **not** do on its own. Treat it as a working
reference for your privacy officer and any legal/security reviewer, **not** as legal advice.

## Which rules actually apply

The portal collects sensitive **personal information** (name, contact, SIN, date of birth,
banking details from a void cheque/PAP, government ID number, income, homeownership proof)
about consumers in **every province**. It does **not** collect payment **card** numbers.

Therefore the governing regimes are:

- **PIPEDA** (federal) — applies to personal information handled in commercial activity.
- **Provincial private-sector laws**, notably:
  - **Quebec — Law 25** (the strictest; consent, privacy officer, breach reporting,
    data-transfer assessments, right to access/erasure/portability).
  - **British Columbia PIPA**, **Alberta PIPA**.
- **PCI-DSS does _not_ apply** — no cardholder data is processed. If card payments are ever
  added, they must be tokenized via a certified processor and PCI-DSS reassessed.

## What the software provides (technical safeguards)

| Requirement area | How it's addressed in code |
|---|---|
| Safeguards proportionate to sensitivity (PIPEDA Principle 7) | AES-256-GCM envelope encryption of the most sensitive fields (`src/lib/crypto.ts`), on top of infra at-rest encryption; TLS/HSTS; CSP and security headers (`src/middleware.ts`). |
| Access limited to those who need it | Role-based access control and strict per-dealer tenant isolation (`src/lib/rbac.ts`), enforced server-side on every query and document fetch. |
| Accountability & access logging | Append-only `AuditLog` records logins, **every decryption of sensitive fields**, decisions, and document upload/download (`src/lib/audit.ts`). |
| Meaningful consent | Versioned consent text captured with timestamp and IP at submission (`Consent` model; `CONSENT_TEXT`/`CONSENT_POLICY_VERSION`). |
| Authentication strength | bcrypt password hashing (cost 12), password-strength policy, account lockout, and TOTP MFA (`src/lib/password.ts`, `src/lib/mfa.ts`). |
| Data minimization prompts | Sensitive fields are optional and the UI flags that only necessary data should be collected. |
| Data residency | Deployment targets AWS **ca-central-1** (Montreal); see `docs/DEPLOYMENT.md`. |
| Document confidentiality | Documents are encrypted before storage and are never exposed via public URLs — only via an authenticated, audited route. |

## What still requires human / organizational work (NOT in code)

These are required for real compliance and **cannot** be satisfied by software alone:

1. **Legal-reviewed consent & privacy-policy wording.** `CONSENT_TEXT` in
   `src/lib/constants.ts` is a **placeholder** and is marked as such. Have a Canadian privacy
   lawyer draft the consent language and a public privacy policy, especially for Quebec Law 25
   (which has specific consent-quality and transparency requirements).
2. **Designated Privacy Officer** and a documented contact channel for access/erasure requests.
3. **Breach-response plan** (PIPEDA "real risk of significant harm" reporting to the OPC and
   affected individuals; Quebec Law 25 breach obligations).
4. **Data-retention schedule** and secure disposal. The schema supports this (soft-delete /
   purge can be added), but the *schedule and legal basis* are an organizational decision.
5. **Subject-access / erasure fulfilment process.** The audit trail and data model make this
   feasible; the operational workflow and identity-verification steps must be defined.
6. **Data-processing / transfer agreements** with any subprocessors (hosting, email), and a
   Law 25 transfer assessment where applicable.
7. **Key management in production.** Use **AWS KMS** (`KMS_KEY_ID`) so the master key never
   leaves the HSM boundary. The KMS wrapping/unwrapping functions in `src/lib/crypto.ts` are
   stubbed with a clear integration point and must be wired up before enabling KMS.
8. **Independent security review / penetration test** before go-live.
9. **Backups, disaster recovery, and monitoring/alerting.**

## Notable design decisions

- **Reveal-on-demand PII.** Staff see masked values by default; revealing full SIN/banking/ID
  writes a `PII_DECRYPT` audit entry every time. This creates an accountability trail for
  access to the most sensitive data.
- **Envelope encryption.** Each sensitive value/document gets a fresh random data key, wrapped
  by a master key. This is defense-in-depth *above* database and object-store encryption, so a
  database dump alone does not expose SIN or banking data.
- **Generic auth errors + lockout** to resist user enumeration and brute force.

## Quick self-audit checklist

- [ ] `SESSION_SECRET` and `MASTER_ENCRYPTION_KEY` are strong and stored in a secrets manager.
- [ ] Production uses `KMS_KEY_ID` with the KMS integration wired up.
- [ ] `STORAGE_DRIVER=s3` with an SSE-KMS bucket in `ca-central-1`.
- [ ] All staff accounts have MFA enabled.
- [ ] `CONSENT_TEXT` replaced with legally-reviewed wording.
- [ ] Privacy policy published; Privacy Officer designated.
- [ ] Retention schedule defined and implemented.
- [ ] Backups + monitoring in place; incident/breach plan documented.
- [ ] Independent security assessment completed.

## Global customer search — cross-office disclosure (privacy note)

The optional **global customer search** (Admin → Security → Customer search,
**off by default**) lets a dealer look up whether a customer is registered with
another office. On a cross-office match it discloses only the **customer's name,
the office name, that office's contact person, phone and coarse location** — never
the customer's address, email, SIN, DOB, or any deal details (the customer's
address is encrypted and is never decrypted for this path). Business purpose:
routing a customer who contacted the wrong office.

Privacy considerations for sign-off before enabling in production:
- This is a **disclosure of personal information to a third-party dealer** under
  PIPEDA / Quebec Law 25 / provincial law. Confirm the purpose is covered by the
  collection consent, or add appropriate consent/notice.
- Safeguards in place: cross-office reveal requires a **full name or full phone**
  (no partial/wildcard fishing), every search is **rate-limited** (30/min/user)
  and **audit-logged** (actor, query, hit counts, action `CUSTOMER_SEARCH`), and
  the whole feature is behind an **admin master toggle**.
- Internal staff (reviewer/admin) get a full search that only surfaces data they
  can already access.
