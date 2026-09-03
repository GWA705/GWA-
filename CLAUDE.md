# GWA Dealer Portal — working notes for Claude

## Brand

Customer-facing copy, naming, contact details, logos, and any generated
report/deck/document must follow the brand kit: **`docs/BRAND-KIT.md`**
(Georgian Water & Air, v1.1). Key rules to keep in mind:

- Display name is **Georgian Water & Air** (ampersand). **Never** use "GWA" or
  "Georgian Water" alone in customer-facing text — "GWA" is internal/logo only.
- Phone/address formatting differs by medium (dots on print/forms, hyphens on
  web); don't mix conventions in one document. Never use the old 761 Bayview Dr
  address.
- Colour palette and typefaces are **[TO CONFIRM]** in the kit — do **not** guess
  hex codes or fonts to make something "look finished." Default to greyscale with
  the logo as the only colour element until confirmed.
- Legal notices (e.g. the Consumer Protection Act notice on sales agreements) are
  reproduced verbatim — never restyled for layout.

See the kit for the canonical contact block, taglines, boilerplate, and
deliverable standards.

## Project memory — read & update these first

This project has no memory between sessions except what's in the repo. So:

- **At the start of work, read `docs/CHANGELOG.md` and `docs/BUILD-FACTS.md`.**
  The changelog is the running record of what's already shipped and — in its
  **Operational status** table — which integrations/env config are live (e.g. the
  sales journal is connected in Render, SMTP is live, DNS auth is set). Don't
  re-ask about or redo something that's already recorded there.
- **When you ship a change, append a dated bullet to `docs/CHANGELOG.md`** in the
  same commit.
- **When an integration goes live or external config changes** (Render env vars,
  DNS, Google, S3, a third-party API), update the **Operational status** table
  with the date — that's the stuff that otherwise only lives in a dashboard and
  gets forgotten.
- **When a core architecture/config fact changes, update `docs/BUILD-FACTS.md`.**

## Repo docs

Other reference material lives in `docs/` (deployment, compliance, security
remediation, AWS migration, etc.).
