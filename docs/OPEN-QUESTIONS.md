# GWA Dealer Portal — Open Questions & Decisions

A running list of things to go over together. Grouped by type and rough
priority. Nothing here blocks the app from running today — these are the
"fill in the real details / make a call" items.

_Last updated: 2026-07-29_

---

## A. Needs something only you can provide (accounts, keys, real data)

1. **Persistent document storage** ⭐ _most important_
   Right now uploads (announcement images, application & funding documents)
   sit on Render's temporary disk and are wiped on every redeploy. Need to
   switch on permanent storage: **Amazon S3** (code is ready — needs a bucket +
   credentials) or a **Render persistent disk** (paid add-on). Decision: which one?

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
    the final rule (you noted it may change).

---

## C. Before going live (accounts, compliance, security)

17. **Retire the placeholder logins** — create real named accounts for you and
    your team and deactivate the seeded `@gwa.example` accounts. Change all
    default passwords.

18. **Organizational privacy controls** — designate a privacy officer, a
    breach-response process, and a data-retention schedule (PIPEDA / Law 25).

19. **Independent security review / penetration test** — recommended before
    handling real customer applications in production.

---

## Notes
- Items in **A** generally need your action first; **B** are quick builds once
  you decide; **C** are go-live gates (some are organizational, not code).
- Add anything new here as it comes up.
