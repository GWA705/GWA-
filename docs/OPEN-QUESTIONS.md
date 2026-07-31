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

3. ✅ **DONE — Email sending (SMTP) is live.** Google Workspace App Password set
   in Render; test email delivered. Emails send from the group address with
   Reply-To to the group. Admin **Email** page shows "Sending" and the From /
   Reply-To are editable in the DB (no redeploy). Reference: `docs/EMAIL-SMTP.md`.

4. **Home Depot store list per dealer** — which HD store numbers each dealer
   is allowed to pick from (the store dropdown on an application).

5. **Finance-company list** — the real companies to approve deals through
   (currently placeholders: FinanceIt, Financeit Home, SNAP Financial).

6. **HD Credit Card guide content** — the actual help text/steps for the
   "HD Credit Card" tab. (Want me to draft a first version you can edit?)

7. **Legal-reviewed consent wording** — the consent text on the application is
   a placeholder; needs a Canadian privacy lawyer (PIPEDA + Quebec Law 25).

8. ⛔ **Parked (your call) — SMS/text notifications.** You said leave text/SMS
   out for now. Email covers notifications today. Reopen if you want texts (needs
   a paid provider like Twilio).

---

## B. Feature decisions I've offered — just say the word

9. ✅ **DONE — Reviewer "Paperwork for dealer" is now one drop zone + a category
   dropdown.** The 4 separate boxes (HD Agreements / HD Waiver / Release of Funds
   / Financing Paperwork) are collapsed into a single upload: pick the type, drop
   the file(s). The category still drives the filename prefix (HD 1 / COC / etc.).

10. ✅ **DONE — Reviewer "Edit deal".** Reviewers/admins get an **Edit deal**
    button on the deal page that opens a full edit form (deal details, applicant,
    address & housing, identification, employment). Older deals can now have ID
    province/type/number/expiry filled in; a deal with no extended record gets
    one created. Sensitive fields are re-encrypted and the edit is audited
    (opening the form is logged as an identity reveal).

11. **Make ID province (and/or ID type) required** on the application form?

12. ✅ **DONE — Archive/Delete for Users and Finance companies.** Same treatment
    as Dealers: archive is reversible; delete is only offered when the record has
    no activity/deals. (Finance-company placeholders no longer re-seed on deploy,
    so admin deletions now stick.)

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

42. ✅ **DONE — Email new users their login details + force first-login change.**
    Creating a user now has an **"Email the login details to the user"** toggle
    (default on). When on (and email configured), the new user gets an email with
    the portal address (portal.ghsbarrie.ca), their username, and the temporary
    password. Every new user must change that password at first login (the temp
    password is treated as expired). If email is off, the user is still created
    with a clear "share the password securely" message.

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

### Recently built (this round)
- ✅ **Reviewer queue overhaul (Chunk 1).** "Attention needed" vs "In progress"
  split, deals move automatically as reviewers act, whole-row highlight + "!",
  red escalation past 2 hours, activity chips (New deal / Funding ready / New
  document / New note / Problem), hours-and-minutes waiting times, and a legend.
- ✅ **Per-deal activity log.** The staff deal page lists every recorded action
  and which team member did it (built for multiple reviewers).
- ✅ **Dealer portal sign.** Announcements renamed to "Dealer portal sign";
  banner shows the full image edge-to-edge.
- ✅ **"Retired" added** to the Employment status dropdown (applicant + co-applicant).

- ✅ **Reviewer queue Chunk 2 — 2-hour "not looked at" alert.** Reviewers/admins
  are emailed when a new deal (submitted application or funding package) has
  waited over 2 hours with no reviewer having looked at it, 8am–10pm Ontario
  time, re-nudging ~every 2h until picked up. Per-person opt-out in My account.
  Triggered by `/api/cron/attention-alerts` (secret-protected); a "Run now"
  button is on the admin Email page. Setup: `docs/SLA-ALERTS.md`.
  **Your part:** set `CRON_SECRET` in Render and add a Render Cron Job that hits
  the endpoint every ~15 min (steps in the doc).

### Parked builds — ready when you say go
- 🅿️ **Products-at-funding.** A products list at the funding stage that softly
  guides the dealer to add a serial number per product (guide, not a hard block).
- 🅿️ **Super-admin account** — you said "another time, not right now."

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

## D. Roadmap — planned work (captured 2026-07-31)

Bigger items we've agreed to do later. Each notes rough feasibility and what's
needed to start. Nothing here is built yet.

43. ✅ **DONE — 2-hour alert now covers unacknowledged uploads too.** In addition
    to brand-new deals/funding packages, the alert fires when a dealer's
    **uploaded document** has waited over 2 hours with no reviewer acting since
    (dealer acted more recently than any reviewer). Notes stay excluded (they
    already send their own email).

44. **Two admin tiers + "view any dealer account."**
    a) **Regular admin** (can be handed to a staff member) — manages users,
       dealers, finance companies, content, email, etc.
    b) **Super-admin** (yours only) — controls the "real backend" (to be
       defined together: e.g. data retention settings, integrations/API keys,
       destructive actions like the go-live wipe, promoting/demoting admins,
       security settings). Regular admins can't touch these.
    c) ✅ **DONE — "View as dealer."** Admins get a **View as** button on each
       dealer (Admin → Dealers). It opens that dealer's portal exactly as they
       see it, with a persistent amber banner ("You are viewing as … — Exit")
       and a one-click exit. It's bound to the admin's own session (signed
       cookie), admin-only, and both start and stop are written to the audit
       log. Data provenance is preserved (any action records the admin's user
       id). *(Still to do: 44a/44b admin-tier split.)*

45. **Google Sheets journal integration.** Write each deal's key info into your
    existing Google Sheets sales journal automatically.
    - **Feasible?** Yes — via the Google Sheets API using a **service account**
      (a machine login) that you share the sheet with. The app appends a row per
      deal (and can update on status changes).
    - Each journal row should include a **link back to the deal** and links to
      the **documents** provided (secure, access-controlled links — not public).
    - **Fallback if we don't want to touch the live sheet:** the app keeps its
      **own journal view** built from the deals entered, with the same document
      links, exportable to CSV/Sheets.
    - **Your part when we start:** decide append-to-existing-sheet vs. app-owned
      journal; if the former, share the sheet with the service account and give
      me the sheet ID + column layout.

46. **Reporting / analytics on the site.** Bring the reporting you currently
    build in Google Sheets into the portal (counts, funnel, probabilities, etc.).
    *(Larger build. Best done after #45 so the data model for reporting is
    settled.)* **Your part:** upload the current Google-Sheets reports + the
    formulas/codes so we can mirror the logic natively.

47. **Privacy & security review (deep pass).** Go through the whole app for
    privacy loopholes and make sure customer personal data is properly secured
    (access control, encryption coverage, audit completeness, least-privilege,
    data minimization). Pairs with the go-live gates in section C (#21, #22).

48. **Automatic deletion of ID data after retention window.** Auto-purge the
    government ID number, ID expiry, and related identity fields (and possibly
    the ID document image) **~15 days after a deal is paid**, so we don't hold
    driver's licenses long-term. *(Medium build — a scheduled purge job like the
    alert cron; needs a clear retention rule per field and an audit entry when
    data is purged. Ties into #47 and Law 25 data-minimization.)* **Decide:**
    exact window (15 days after payment?), and which fields/documents to purge
    vs. keep.

49. **FinanceIT calculator API (Dealer Support).** Wire in FinanceIT's payment
    calculator via their API so dealers can quote payments in-portal.
    *(Feasible once we have their API docs.)* **Your part:** get from FinanceIT —
    API documentation, the endpoint(s), authentication method + credentials, and
    any usage terms. We'll review together before building.

50. **First-login tutorial / guided tour.** A short pop-up walkthrough on first
    login (click-through "OK" windows) introducing the main areas and actions.
    - **Feasible?** Yes.
    - **Toggle on/off:** yes — auto-shows once per user, with a "Show me the
      tour again" option in My account so they can replay it anytime.
    *(Small–medium build. Provide the copy/steps for each screen when we start,
    or I can draft a first version.)*

---

## Notes
- Items in **A** generally need your action first; **B** are quick builds once
  you decide; **C** are go-live gates (some are organizational, not code);
  **D** is the agreed roadmap of bigger items.
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
