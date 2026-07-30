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

2. **Google Maps API key** — to turn on address autocomplete on the Street
   address field. You create it in Google Cloud (billing account required),
   then add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in Render and redeploy.

3. **Google Workspace email credentials** — to switch email from "log-only"
   to actually sending (password resets, status updates, etc.). Need the
   mailbox + App Password (e.g. a real `hello@ghsbarrie.ca`, send-as
   `noreply@ghsbarrie.ca`).

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

9. **Reviewer "Paperwork for dealer" upload** — collapse the 4 separate boxes
   (HD Agreements / HD Waiver / Release of Funds / Financing Paperwork) into
   **one drop zone with a category dropdown**. (No issue uploading just one type.)

10. **ID province / ID type on older deals** — add an "Edit deal" option so
    reviewers can fill these in on deals created before those fields existed.

11. **Make ID province (and/or ID type) required** on the application form?

12. **Archive/Delete for Users and Finance companies** — same treatment we
    added to Dealers (archive = reversible, delete only when unused)?

13. **Password minimum length** — currently 12 characters. Keep it, or lower it?

14. **"If applicable" placeholders** on other optional reference fields (e.g.
    the FinanceIt deal # currently shows "(if approved)").

15. **Confirmation-call script** — confirm the questions/checklist wording is
    exactly what you want.

16. **FinanceIt number rule** — currently "7 digits starting with 7." Confirm
    the final rule (you noted it may change). *(Resolved: now accepts any format
    up to 60 chars — reopen if you want a strict rule.)*

24. **Admin bulk download / export of documents** — since files in S3 are
    encrypted at rest, they can only be read through the portal. Build an admin
    "Download" option that decrypts on the fly: e.g. a "Download all documents
    (ZIP)" button on a deal, and/or an admin export by dealer / date range.
    Access-controlled and written to the audit log.

25. **Announcement banner image polish** 🐞 —
    a) **Auto-fit uploaded pictures** to the banner area instead of cropping
       them (currently `object-cover` cuts off the top/bottom — the GWA logo is
       clipped). Show the whole image scaled to fit.
    b) **Broken image window** — an announcement is showing a broken-image "?"
       box because its image file is missing (uploaded before S3 was on, lost on
       redeploy). Hide the image gracefully when it can't load, and let the admin
       spot/clean up the orphaned announcement. (New uploads now persist in S3.)

26. **Progress tracker cut off on mobile** 🐞 — the 7-step deal tracker
    (Submitted → … → Paid) is a fixed-width row, so on a phone the later steps
    (In for funding / Funded / Paid) run off the right edge. Make it responsive:
    e.g. a compact/scrollable stepper on small screens, smaller dots+labels, or
    a "Step X of 7" summary. Should fit within the phone width.

27. **Rename "New credit application" → "New customer processing."** Update it
    everywhere it appears for consistency: the page heading, the top-nav link
    ("New application"), and the "New application" button on the dealer home.

28. **Redesign the entry-method chooser into three speed-ranked, colour-coded
    options.** Heading: "Three choices to process a new customer application."
    Add depth to the cards (speed badge + colour, maybe an icon):
    - **1 · Fastest** (green): "Use your FinanceIt Portal to approve the
      application and submit your approval FinanceIt loan number below."
      → current **Financing number / FINANCEIT** method.
    - **2 · Fast** (blue): "Need a different financing option? Type in the
      customer details below (helps with spelling and ensures accuracy of the
      application)." → current **Type it in / TYPED** method.
    - **3 · Normal** (amber/grey): "Upload application and bill of sale for
      processing." → current **Upload a photo / PHOTO** method (allow uploading
      the application **and** the bill of sale).
    Order them Fastest → Fast → Normal.

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

23. **Rotate the AWS access key** 🔐 — the S3 secret key was shown in a
    screenshot during setup. Create a fresh key (IAM → gwa-portal-app →
    Security credentials → delete old → create new), update
    `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in Render, then redeploy.
    Type the values straight into Render — don't screenshot them.

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
