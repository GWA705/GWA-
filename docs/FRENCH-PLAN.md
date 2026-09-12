# Fully French-facing dealer experience — plan

Goal: a **dealer** can run the entire portal in French — not just the in-app copy
(already draft-translated) but everything generated outside the live UI: emails,
push notifications, generated PDFs, the AI assistant, and the portal name itself.

## Decisions (confirmed by Sean, 2026-09-12)
- **Scope: dealer-facing only.** Staff/reviewer and the admin console stay as-is
  (their UI is already draft-translated; not part of this effort).
- **Language source: a saved per-user preference.** Add `User.language` ("en"/"fr"),
  set from the header toggle and editable in My Account. Server code (emails, push,
  PDFs) resolves a recipient's language from this field — the UI cookie can't reach
  background sends.
- **All generated output in French:** every dealer-facing email, push notification,
  and generated PDF follows the recipient's saved language.
- **French portal name: "Portail concessionnaire GWA"** for French users; English
  users keep "GWA Dealer Portal". (Naming already standardized on
  *concessionnaire* / *Dealer Portal* — 2026-09-12.)

## Current state
- EN/FR UI toggle is LIVE (`NEXT_PUBLIC_I18N_ENABLED=1`); dealer + staff dictionaries
  exist (`src/i18n/dictionaries/{en,fr}.ts`), switched by cookie via `getT()`/`useT()`.
- DeepL auto-translates user-typed content.
- English-only today: most transactional emails (only account-creation has FR),
  portal name/wordmark, push notifications, generated PDFs, AI assistant, admin
  console, and the verbatim Consumer Protection Act consent text.

## Phases

### Phase 0 — Foundation: saved per-user language  ← start here
- Prisma: `User.language String @default("en")` (+ migration).
- Persist the header toggle to the user (server action) alongside the cookie; add a
  language selector in **My Account**.
- Server helper `resolveUserLocale(userId)` and a locale-aware `getT` for background
  sends, so any server code can render in a recipient's language.

### Phase 1 — Portal name / wordmark (per locale)
- `AnimatedWordmark` / `AppShell`: "Portail concessionnaire GWA" when the dealer's
  locale is FR.
- Email FROM name: per recipient ("Portail concessionnaire GWA" vs "GWA Dealer Portal").
- Share/OG title where feasible.
- Notes: PWA install name (`manifest.ts`) is single-valued per install — serve an FR
  manifest by locale cookie, or accept EN there. MFA issuer stays "GWA Dealer Portal"
  (authenticator apps key on a stable issuer — do not localize).

### Phase 2 — Emails fully bilingual (dealer recipients)
Audit + FR versions, chosen by recipient's saved language, for each dealer-facing
email: account creation (done), password reset (`(auth)/actions.ts`), MFA code
(`mfa-email.ts`), sign-in alert (`signinAlert.ts`), mail/notification emails,
gift-card emails, dealer report links (`emailDealerReport`), request-access/onboarding.
Subjects, bodies, and CTA labels all FR.

### Phase 3 — Push notifications localized
Localize title/body by recipient language wherever push payloads are built.

### Phase 4 — Generated PDFs / print in French
Payout receipt (`DealerCalculator` print block) and the report one-pagers
(OfficeRangeView, dealer funding, etc.) render labels in the viewer's locale. Browser
print follows the UI locale IF the content uses `t()`; audit and fix hardcoded English.

### Phase 5 — AI assistant replies in French
`ai.ts`: pass the user's locale and instruct the assistant to answer in that language.

### Phase 6 — Formatting & copy polish
fr-CA date/number/currency formatting on dealer surfaces where `en-CA` is hardcoded;
tighten the draft FR translations of dealer-facing copy.

### Phase 7 — Legal consent (CPA) in French  (external dependency)
Verbatim FR consent text from the Québec team; slotted in when received — never
machine-translated (reproduced verbatim per the brand kit).

## Out of scope
Staff/reviewer and admin-console full localization; machine-translating legal text.
