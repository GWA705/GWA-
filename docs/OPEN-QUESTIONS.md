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
