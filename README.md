# GWA Credit Portal

A secure, two-stage credit **application** and **funding** portal for GWA (Barrie, ON).
Dealers submit consumer credit applications with supporting documents; GWA's team reviews,
approves, and funds them. Built for **Canadian privacy compliance** (PIPEDA + provincial
law, incl. Quebec Law 25) with encryption in transit and at rest, per-dealer tenant
isolation, MFA, and an append-only audit trail.

> **Scope note:** No credit **card** data is collected anywhere, so PCI-DSS does not apply.
> The governing requirements are privacy law + security best practice. See
> [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) for the full posture and the organizational
> items that still require legal/security sign-off before production go-live.

## What it does

**Dealer portal** (`/dealer`)
- Submit a credit application (applicant PII, co-applicant, financials, consent capture).
- Upload supporting documents.
- Track status (Submitted → Under review → Approved/Declined/Conditional → Funded).
- After approval: submit the **funding package** — serial numbers, signed contract, void
  cheque/PAP, install photos, signed HD documents, government ID, and proof of homeownership
  (when required) — with a completeness checklist.

**Staff review portal** (`/staff`)
- Review queue and funding queue with status filters.
- Application detail with **reveal-on-demand, audited** decryption of sensitive fields.
- Decision workflow: approve / conditionally approve / request docs / decline; and fund.

**Admin** (`/admin`)
- Manage dealers and users, assign roles, activate/deactivate accounts.
- Browse the audit log.

**Account security** (`/account`)
- Self-service TOTP two-factor enrollment (QR code) for every user.

## Security architecture (summary)

| Control | Implementation |
|---|---|
| Encryption in transit | HTTPS/HSTS; strict security headers + CSP (`src/middleware.ts`) |
| Encryption at rest (app-level) | Envelope encryption, AES-256-GCM per-record data keys (`src/lib/crypto.ts`) for SIN, banking, government ID, DOB, address, MFA secrets |
| Encryption at rest (infra) | Production: RDS encryption + S3 SSE-KMS underneath the app-level layer |
| Document handling | Files encrypted before storage; served only through an authenticated, audited route (`/api/documents/[id]`) — no public URLs |
| AuthN | Password (bcrypt, cost 12) + optional TOTP MFA; account lockout after repeated failures |
| AuthZ / tenancy | Central RBAC (`src/lib/rbac.ts`); dealers are strictly isolated to their own applications, enforced server-side |
| Auditability | Append-only `AuditLog` of logins, PII decryption, decisions, uploads/downloads (`src/lib/audit.ts`) |
| Consent | Versioned consent text captured with timestamp/IP at submission |
| Data residency | Target AWS **ca-central-1** (Montreal) — see `docs/DEPLOYMENT.md` |

## Tech stack

Next.js 14 (App Router) · TypeScript · PostgreSQL + Prisma · Tailwind CSS · `jose` (sessions)
· `otplib` (MFA) · `bcryptjs` · Zod · AWS SDK (S3/KMS) · Vitest.

## Deploy to the web (beginner-friendly, via GitHub)

New to deployment? Follow **[`docs/DEPLOY-RENDER.md`](docs/DEPLOY-RENDER.md)** —
a click-by-click guide that puts a **test/staging** copy online from GitHub with
no terminal commands (uses the included `render.yaml`). Use fake data only; real
customer data requires the Canadian-region production setup in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Local development

Requires Node 20+ and a PostgreSQL 14+ database.

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, and generate real secrets:
#   openssl rand -base64 48   # SESSION_SECRET
#   openssl rand -base64 32   # MASTER_ENCRYPTION_KEY (must decode to 32 bytes)

# 3. Create the schema and seed sample data
npx prisma migrate dev
npm run db:seed

# 4. Run
npm run dev        # http://localhost:3000
```

### Seeded logins (development only — change before any real use)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@gwa.example` | `ChangeMe!Admin123` |
| Reviewer | `reviewer@gwa.example` | `ChangeMe!Review123` |
| Dealer (Barrie) | `dealer@barrie.example` | `ChangeMe!Dealer123` |

## Scripts

```bash
npm run dev          # dev server
npm run build        # prisma generate + production build
npm start            # run the production build
npm run typecheck    # tsc --noEmit
npm test             # vitest (crypto round-trip, tenant isolation, password policy)
npm run db:seed      # seed sample data
npm run prisma:migrate  # create/apply a dev migration
```

## Tests & verification

- **Unit:** `npm test` — encryption round-trip + GCM tamper detection, tenant-isolation RBAC,
  password strength/hashing.
- **Build:** `npm run build` compiles all routes and the middleware.
- **Manual end-to-end:** see the "Verification" section of `docs/DEPLOYMENT.md`.

## Repository layout

```
prisma/schema.prisma        Data model (applications, documents, decisions, audit, consent)
prisma/seed.ts              Sample dealers/users/application
src/lib/                    Security core: crypto, storage, session, mfa, rbac, audit, validation
src/middleware.ts           Route guards + security headers/CSP
src/app/(auth)/             Login + MFA
src/app/(dealer)/           Dealer portal
src/app/(staff)/            Staff review + funding verification
src/app/(admin)/            Admin + audit log
src/app/(account)/          Self-service 2FA
src/app/api/documents/[id]/ Authenticated, audited document download
```

## Important

This codebase is a secure **foundation**. Production go-live additionally requires
legal-reviewed consent/privacy wording, a designated privacy officer, a breach-response
process, a data-retention schedule, and ideally an independent security review — see
[`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).
