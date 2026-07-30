# GWA Dealer Portal — Open Questions & Decisions

A running list of things to go over together. Grouped by type and rough
priority. Nothing here blocks the app from running today — these are the
"fill in the real details / make a call" items.

_Last updated: 2026-07-30_

---

## A. Needs something only you can provide (accounts, keys, real data)

1. ✅ **DONE — Persistent document storage (S3).** Live on Render with an S3
   bucket in ca-central-1 (Canada). Uploads now persist across redeploys.
   Setup reference kept at `docs/STORAGE-S3.md`.

2. ✅ **DONE — Google Maps address autocomplete.** Key created & restricted
   (Websites: portal.ghsbarrie.ca; Maps JavaScript API + Places API), set as
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Render, live. Street address now
   autocompletes and fills city/province/postal.

3. 🟡 **Email sending (SMTP) — code ready, needs your App Password.** The email
   layer is built and proven; it sends the moment SMTP is configured. New admin
   **Email** page: live status (Log-only / Sending), a **Send test email**
   button, an editable **From name / From (group) address / Reply-To (group)**
   (stored in the DB, no redeploy), and an inline setup guide. Emails come
   **from** your group address with **Reply-To** set to the group so replies
   reach the whole team. Step-by-step: `docs/EMAIL-SMTP.md`.
   **Your part:** create a Google Workspace App Password and set `SMTP_HOST`,
   `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` in Render (see the guide).

4. **Home Depot store list per dealer** — which HD store numbers each dealer
   is allowed to pick from (the store dropdown on an application).

5. **Finance-company list** — the real companies to approve deals through
   (currently placeholders: FinanceIt, Financeit Home, SNAP Financial).

6. **HD Credit Card guide content** — the actual help text/steps for the
   "HD Credit Card" tab. (Want me to draft a first version you can edit?)

7. **Legal-reviewed consent wording** — the consent text on the application is
   a placeholder; needs a Canadian privacy lawyer (PIPEDA + Quebec Law 25).

8. **SMS/text notifications** — email works today; texting needs a paid text
   provider (e.g. Twilio). Do you want texts too, and via which provider?

---

## B. Feature decisions I've offered — just say the word

9. ✅ **DONE — Reviewer "Paperwork for dealer" is now one drop zone + a category
   dropdown.** The 4 separate boxes (HD Agreements / HD Waiver / Release of Funds
   / Financing Paperwork) are collapsed into a single upload: pick the type, drop
   the file(s). The category still drives the filename prefix (HD 1 / COC / etc.).

10. **ID province / ID type on older deals** — add an "Edit deal" option so
    reviewers can fill these in on deals created before those fields existed.

11. **Make ID province (and/or ID type) required** on the application form?

12. **Archive/Delete for Users and Finance companies** — same treatment we
    added to Dealers (archive = reversible, delete only when unused)?

13. **Password minimum length** — currently 12 characters. Keep it, or lower it?

14. ✅ **DONE — "If applicable" placeholders.** The FinanceIT deal # field now
    shows "If applicable" (and its label hint reads "(if applicable)"), except
    when the Fastest/FINANCEIT method is chosen, where it prompts "FinanceIT
    loan number."

15. **Confirmation-call script** — confirm the questions/checklist wording is
    exactly what you want.

16. **FinanceIt number rule** — currently "7 digits starting with 7." Confirm
    the final rule (you noted it may change). *(Resolved: now accepts any format
    up to 60 chars — reopen if you want a strict rule.)*

24. ✅ **DONE — "Download all documents (ZIP)" on a deal.** Reviewers/admins get a
    button on the deal page that streams every document as a single ZIP,
    decrypted on the fly, foldered by stage (Application / Funding / Paperwork),
    de-duplicated, and written to the audit log. Unreadable/orphaned files are
    skipped rather than failing the whole download. (A dealer/date-range export
    can follow later if you want it.)

25. ✅ **DONE — Announcement banner image polish.**
    a) Images now auto-fit (`object-contain`, `max-h-72`) — the whole picture is
       scaled to fit, no more cropping/clipping.
    b) A new `BannerImage` client component hides the image gracefully if the
       file can't load (orphaned/missing), so no broken-image "?" box shows.

26. ✅ **DONE — Progress tracker fits on mobile.** The 7-step tracker now uses
    `min-w-0 flex-1` columns that share the width and shrink to fit, with
    smaller dots/labels on small screens (`h-6 w-6` / `text-[10px]`). No more
    running off the right edge on a phone.

27. ✅ **DONE — Renamed "New credit application" → "New customer processing"**
    everywhere: page heading, top-nav link ("New customer"), and the dealer
    home button ("New customer processing").

28. ✅ **DONE — Three speed-ranked, colour-coded entry-method cards.** Heading:
    "Three choices to process a new customer application." Cards ordered
    **1 · Fastest** (green, FINANCEIT), **2 · Fast** (blue, TYPED),
    **3 · Normal** (amber, PHOTO), each with a numbered speed badge and the
    agreed copy.

29. ✅ **DONE — "FinanceIT" spelling** used in all user-facing text (code
    identifiers `financeItNumber` / `FINANCEIT` left unchanged).

30. ✅ **DONE — Reviewer→dealer paperwork filenames prefixed by category.**
    Reviewer-stage uploads now carry a category prefix in front of the existing
    customer + date name (`REVIEWER_PAPERWORK_PREFIX`):
    - HD Agreements → **"HD 1"**
    - Home Depot Waiver → **"HD Waiver"**
    - Financing paperwork → **"Finance contract"**
    - Release of funds / completion certificate → **"COC"**
    e.g. `HD 1 Tetser_Sean_2026-07-30_….pdf`.

31. **Refine the "Paperwork from GWA" section (dealer side).**
    a) ✅ **DONE — Renamed to "Paperwork for your Customer."**
    b) ✅ **DONE — Refined file cards.** New `PaperworkCards` component renders
       each document as its own card with a PDF/IMG icon, its category label,
       size, date, and separate **View** / **Download** actions. Download uses a
       new `?download=1` mode on the document route (forces "Save as").

32. ✅ **DONE — Removed "Finance reference #" and "HD Customer #" inputs from the
    dealer application form.** These are set by the reviewer after approval (via
    the deal-references form on the staff side), so there's no reason for the
    dealer to fill them in when creating an application. The fields remain in the
    data model (reviewer-set, searchable, shown on the deal) — only the dealer
    inputs were removed.

33. ✅ **DONE — Added a "Start here" badge** above the "Three choices to process a
    new customer application" heading on the dealer application form.

36. ✅ **DONE — Co-applicant activation.** On the typed application, entering a
    co-applicant first name now opens the full co-applicant questionnaire — the
    same questions asked about the main applicant: name, DOB, contact, marital
    status, relationship, address, photo ID (type/number/province/expiry), and
    employment/income. Stored on the loan record with the sensitive fields (DOB,
    address, ID number) application-encrypted at rest; shown on the deal detail
    page (decrypted for the dealer who entered it; reveal-gated + audited for
    staff). Required a purely-additive DB migration.

39. ✅ **DONE — Shade the funding-document cards by state.** On the dealer deal
    page, each funding-document card is now tinted by its state — red (Missing),
    amber (Uploaded — pending), green (Confirmed) — while the upload dropzone
    inside each card stays white.

38. ✅ **DONE — Paperwork View/Download buttons pop.** The dealer "Paperwork for
    your Customer" cards now use a solid green Download button and a green
    outline View button so they stand out.

37. ✅ **DONE — Outline the whole form in the selected option's colour.** Picking
    option 1/2/3 now tints every input's outline (ring) in that method's colour —
    green (Fastest), blue (Fast), amber (Normal) — outline only, no fill. Red
    still wins on a field with an error. (Also fixed the CSS layering so ring-
    colour utilities actually override the default gray ring — this is what makes
    both the method colour and the #35 red outline render.)

35. ✅ **DONE — Highlight missing fields in red + expand required set for option 1.**
    a) On a validation error, each affected input (not just the summary list) now
       gets a red outline/background so it's obvious where to look. The red
       clears once the field is filled and re-submitted.
    b) The Fastest / FinanceIT path (option 1) now requires the full set: street
       address, province, financing details (program/category/amount + the
       FinanceIT number), and deal details (date of sale, installation date, and
       Home Depot store when the dealer has stores assigned). Other methods keep
       their lighter required set.

34. ✅ **DONE — Guide the dealer to the financing-deal-number field when option 1
    (Fastest / FinanceIT) is selected.** The field now highlights in green (green
    box + ring + "← enter your FinanceIT number here" label) and shows an example
    number (`7779477`) so the dealer can confirm they're entering the right
    number before submitting.

17. ✅ **DONE — Progress bar reacts to status changes.** The tracker now keys off
    the live status: moving a deal backward (e.g. Approved → Under review)
    un-lights later steps, and Problem / Declined / Withdrawn show an off-path
    flag. Fact-based steps (docs, confirmation, paid) stay based on what happened.

18. ✅ **DONE — Confirmation buttons clarified.** They already worked; the cause
    was "Confirm complete" being disabled until all six boxes are checked, and
    "Save" not changing the status badge (by design). Now shows how many boxes
    remain, a clearer disabled state, and a note explaining Save vs Confirm.

19. ✅ **DONE — Serial number field clears after Add.**

---

## C. Before going live (accounts, compliance, security)

20. **Retire the placeholder logins** — create real named accounts for you and
    your team and deactivate the seeded `@gwa.example` accounts. Change all
    default passwords.

21. **Organizational privacy controls** — designate a privacy officer, a
    breach-response process, and a data-retention schedule (PIPEDA / Law 25).

22. **Independent security review / penetration test** — recommended before
    handling real customer applications in production.

23. ✅ **DONE — Rotated the AWS access key.** New key created, updated in Render,
    old key deleted; live site healthy and serving from S3 after the rotation.

40. ✅ **DONE — Heading now reads "Three choices to process a new customer"**
    (dropped "application").

41. ✅ **DONE — Emails come from a group address with Reply-To to the group**, and
    the From name / From address / Reply-To are editable in the admin Email page
    (stored in the DB, no redeploy). See #3.

---

## Notes
- Items in **A** generally need your action first; **B** are quick builds once
  you decide; **C** are go-live gates (some are organizational, not code).
- Add anything new here as it comes up.

### ⚠️ render.yaml is intentionally out of sync (do not naively edit)
The live Render setup is managed in the **dashboard**, which is the source of
truth: web service = **Pro**, database = **Basic (5 GB)**, `STORAGE_DRIVER=s3`
(+ S3 vars & AWS keys), paid & always-on. The committed `render.yaml` still
says `plan: free` and `STORAGE_DRIVER: local` from the original demo blueprint.
Render only re-syncs the blueprint when `render.yaml` itself changes, so normal
code deploys are safe and have never reverted the dashboard. **Before ever
editing render.yaml, reconcile it to match the dashboard** (plans + S3 +
`SESSION_SECRET`/`MASTER_ENCRYPTION_KEY` as `sync:false`) or a sync could revert
the upgrades / switch storage back to local and lose file access.
