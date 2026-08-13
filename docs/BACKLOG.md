# GWA Portal — Ideas & Feature Backlog

A running list of things to add or change. Just capture ideas here as they come;
we'll organize and prioritize them together later.

**Status:** 🟢 Collecting ideas (add freely, no order needed)

---

## Inbox (captured ideas)

> Grouped by theme for readability. Nothing here is built yet — this is the
> collection list. `❓` marks items where we'll need a decision or more info
> during the rework pass.

### Files & documents
- [ ] **Auto-convert every uploaded file to PDF** and store it as a PDF, whatever the original type.
- [ ] **Standardized PDF naming:** each saved PDF named with the customer's name, the date of purchase, and a date+time stamp.
- [ ] **Organized storage structure per dealer:** Dealer → Year → Month → Week → files. ❓ Open to a better organization scheme if Claude proposes one.
- [ ] **Multi-file upload:** select and upload many documents at once with a single click (not one at a time).
- [ ] **View files by role:** Dealer, Reviewer, and Admin can open a customer profile and select/view the files inside it (dealers see only their own — see Search rules).

### Programs
- [ ] **Two program types:** **HD** and **GWA**.
- [ ] **Sub-categories for each program:** Water, Air, Smell Busters, HVAC. _(Replaces today's free-text "program" field with a program → sub-category selection.)_

### New application — financing details
- [ ] **Financing note field:** under "Financing details," add a note box where the dealer writes what kind of financing deal or promotion they'd like with this application.
- [ ] **Three ways for a dealer to provide the credit application:**
  1. **Type it into the site** — enter the application details directly. **Template provided:** the FinanceIt "Loan Application" paper form (photo supplied). The digital typed-entry form should mirror its layout/sections: **Personal Details** (Photo ID first/middle/last name, home & mobile phone, birthdate, marital status, SIN, email), **Housing** (address/unit, city, province, postal code, years at address, monthly housing cost, own/rent/other), optional **Mailing / Previous / Work-site addresses**, **Borrower Identification** (photo ID type/number/province/expiry), **Employment & Income** (business name, position, employer address & phone, gross monthly income, time at job, employment status), **Consents** (privacy policy + electronic disclosures), and **Credit Authorization** (signature + date). Build as **GWA-branded** (not FinanceIt branding); consent wording is placeholder pending legal review.
  2. **Upload a photo** of the paper credit application for processing.
  3. **Enter just the FinanceIt approval number** — providing it indicates the deal is already approved.
- [ ] **Encourage typing over photo:** nudge dealers to type the info in (fewer errors on the customer's application than a photo).
- [ ] **FinanceIt approval number validation:** currently **7 digits, starting with 7** ("…until it doesn't" — treat the rule as configurable so it can change later). ❓ Confirm final rule.

### Deal intake (dealer-entered fields)
- [ ] **Require dealers to enter basic info for each deal:**
  - Customer name
  - Date of sale
  - Address
  - Phone number
  - Home Depot store number — **drop-down list** of only the stores available to that dealer (not free text)
  - Installation date
  - _(Note: name / address / phone already exist on today's application form; date of sale, Home Depot store #, and installation date are new fields to add.)_
- [ ] **Per-dealer Home Depot store list:** each dealer has a defined set of HD stores they can pick from; the store dropdown shows only those. ❓ Admins assign which stores belong to each dealer (store list/assignment to be provided).

### Address autocomplete
- [ ] **Smart address entry:** as the dealer types an address, show a dropdown of matching real addresses; clicking one auto-fills the street, city, province, and postal code fields. Should correct/validate the address and fill in the postal code. ❓ Needs a lookup provider (options: Canada Post AddressComplete — Canadian & great for postal codes, or Google Places Autocomplete) — has a per-use cost / API key; pick provider at rework.

### Wording / labels
- [ ] **Rename "Supporting documents" → "Documents for approval"** (the docs a dealer uploads at the application stage).
- [ ] **Phone number format:** display/format phone numbers as `705-812-0320` (auto-format as the user types).
- [ ] **Postal code format:** display/format Canadian postal codes as `L0L 2T0` (uppercase, space in the middle; auto-format as the user types).

### Search
- [ ] **Global search** by: Loan reference #, Finance reference #, HD reference #, and customer first or last name. ❓ (Requires adding these reference-number fields to each deal.)
- [ ] **Search scoping:** Dealers can only search deals *they* uploaded; Reviewers and Admins can search all deals.
- [ ] **⭐ Site-wide global search with linked info (to discuss — raised Aug 2026).**
  One search box across the whole site that returns *linked* results — deals,
  customers, dealers, leads, users — so you can jump straight to the record and
  its connections. Key use case Sean raised: look up a customer and see **which
  dealer they belong to**, *even if another dealer is searching* and the customer
  is already in the system.
  - ❓ **Big decision — tenant isolation / privacy.** Today a dealer can only ever
    see their own office's data. Letting one dealer discover that a customer
    belongs to *another* dealer crosses that boundary and exposes a competitor's
    customer relationship + PII. Options to weigh:
    (a) **Internal-only cross-dealer search** — reviewers/admins search everyone;
        dealers stay scoped to their own (safest, no isolation change).
    (b) **"Already in system" flag for dealers** — a dealer typing a customer sees
        only *"this customer already exists with another dealer — contact GWA,"*
        with **no** name/office/PII of the other dealer revealed (dedupe without
        disclosure).
    (c) **Full cross-dealer visibility for dealers** — most useful, but a real
        privacy/competitive exposure; would need explicit business + legal signoff.
  - Also decide: what entities are searchable, ranking, and how results link
    (deal → dealer → office → leads). Revisit as its own planning pass.

### Statuses, colours & progress indicators
- [ ] **Dealer "Confirmations" area** (similar to the approvals area) with statuses, each with its own colour:
  - Confirmation completed
  - Pending confirmation
  - Issues with confirmation
- [ ] **Review-status colour + icon** that changes as the reviewer's status changes.
- [ ] **Same colour/icon visible on the Dealer side** so dealers see the deal's progress at a glance.
- [ ] **Priority flag** for deals where someone is waiting on an approval — surface these first.

### Sort / filter by status (all logins)
- [ ] **Status sort/filter built into every login** (Dealer, Reviewer, Admin) to filter the deal list by status. Starting set (extensible):
  - Submitted
  - Approved
  - In for funding
  - Funded
  - Problem
  - _(More statuses can be added; these will map to / extend the app's existing status list.)_

### Notifications & communication
- [ ] **Reviewer notification when new documents are uploaded** (so they know something needs review) — via email and/or text.
- [ ] **Dealer email notifications** on deal progress/status changes.
- [ ] **Follow-up / reminder notifications** when a deal sits unchanged for too long (stale-deal nudges).
- [ ] **Communication-preference toggles:** let users choose how they're contacted. ❓ Only offer channels we can actually deliver (email is straightforward; SMS is doable but needs a paid text provider — to confirm at rework).

### Application summary & finance companies
- [ ] **Application summary shows:** customer name, approval status, **approved by** (which reviewer), **the finance company** that approved it, and the **approved amount**.
- [ ] **Maintain a list of finance companies** (managed in the backend). ❓ (Company list to be provided.)
- [ ] **Reviewer marks which finance company approved the deal;** that selection appears in the application summary.

### Payouts
- [ ] **Payout receipt / statement per deal:** show the dealer what was paid on the deal. Clickable from the deal so, if there are questions, they can open a receipt/statement of what was paid.

### Confirmation calls (reviewer/confirmer)
- [ ] **HD confirmation notes:** free-text notes the confirmer jots down during a confirmation call (reviewer side).
- [ ] **Confirmation script with checkboxes:** a script of simple questions appears as a checklist; the confirmer checks every box, then clicks **Confirm**. ❓ (Exact script/questions to be provided.)
- [ ] **Share completed confirmation with the dealer:** a copy of the completed confirmation (script + checks) is shown to the dealer too.

### Reviewer ↔ Dealer collaboration & notes
- [ ] **Per-deal note to the dealer:** reviewers can write notes to the dealer; notes live inside that customer's profile (visible to the dealer).
- [ ] **Internal notes (reviewer/Admin only):** a separate per-deal notes area visible *only* to Reviewers and Admins — never shown to dealers.
- [ ] **Reviewer → dealer paperwork uploads:** a section on the reviewer side to upload paperwork *for* the dealer, in two categories:
  - **HD**
  - **Financing paperwork**
  Dealers can view and **download/print** these documents. ❓ Scope to confirm at rework: per-deal (attached to a specific customer) vs. per-dealer (general).

### Dealer dashboard highlights
- [ ] **Announcements / highlights area on the dealer home page:** a small spot that surfaces promotions, updates, or important messages for dealers. If nothing urgent, it cycles through a set list of promotions. ❓ Fully editable from the backend (Admin can add/edit/reorder the messages).

### New tabs / sections
- [ ] **Resources tab** (top nav, for dealers): a place to upload and share documents/resources dealers can access.
- [ ] **"HD Promotions" tab** (top nav): promotions section.
- [ ] **"HD Credit Card" tab:** a help guide for dealers processing an HD credit card. ❓ Content to be provided later.

### Dealer profile
- [ ] **Dealer profile page** where dealers fill in contact information; that contact info feeds the email notifications.

### Security & accounts
- [ ] **Password expiry / forced rotation every 3 months (90 days):** users are required to set a new password when theirs expires.
- [ ] **Password complexity:** must contain uppercase, lowercase, a number, and/or another character. _(Already enforced today: min length + upper + lower + number + symbol; we'll align the rule to whatever you finalize.)_
- [ ] **"Forgot password" self-service reset:** user clicks *Forgot password*, gets an email with a secure link, and sets a new password.
- [ ] **Capture login IP addresses.** _(Already captured: every login success/failure is recorded with its IP in the audit log — we can add a clear per-user "recent logins / IPs" view on top.)_

### Cross-cutting (applies to the whole app)
- [ ] **Fast & fluid is the #1 priority.** The app should feel quick and responsive with minimal clicks/waiting. Design every workflow to be efficient — keyboard shortcuts, quick actions, smart defaults, and as few steps as possible — so power users can move fast. Treat speed/fluidity as a first-class requirement on every feature.
- [ ] **Responsive design — works well on phone, PC, and Mac.** Every screen (forms, tables, uploads, dashboards) must lay out properly on a small phone screen and on a full desktop browser. _(The current build already uses a responsive framework and adapts to some degree; this makes "polished on mobile + desktop" an explicit requirement to verify on every feature.)_

### Logging
- [ ] **Everything recorded in a reviewable log** (extend the existing audit log to cover uploads, conversions, status changes, notifications, and notes).

---

## Build roadmap (organized & prioritized)

Grouped into phases so each one ships a coherent, usable improvement. Items marked
❓ in the inbox need info from you but won't block the rest of the phase — we build
the mechanism now and drop your content/keys in when ready.

### Phase 1 — New application experience (dealer intake) ✅ DONE
- Program types **HD / GWA** + sub-categories (Water, Air, Smell Busters, HVAC) — replaces free-text program.
- New deal fields: **date of sale**, **installation date**, **Home Depot store #** (per-dealer dropdown), plus date-of-purchase.
- Digital **loan application** form (from the approved mockup) as the "type it in" method.
- Three ways to provide the application: type it in / upload a photo / enter a **FinanceIt approval number**.
- **Financing note** field under Financing details.
- Input formatting: **phone `705-812-0320`**, **postal `L0L 2T0`**, SIN.
- Rename **"Supporting documents" → "Documents for approval."**
- (Address autocomplete: build later in phase once a lookup provider is chosen.)

### Phase 2 — Documents & funding ✅ DONE
- **Multi-file upload** (many at once, one click).
- **Auto-convert uploads to PDF** + standardized naming (customer name + date of purchase + timestamp).
- **Organized per-dealer storage** (Year → Month → Week, or a better scheme).
- **View/download documents by role**; reviewer → dealer paperwork uploads (**HD**, **Financing paperwork**).
- **Payout receipt / statement** per deal.

### Phase 3 — Workflow: statuses, search, summary, confirmations ✅ DONE
- Expanded **statuses + colours + icons** (visible on both reviewer and dealer sides); **sort/filter by status**; **priority** flag; **stale-deal follow-ups**.
- **Reference numbers** (loan / finance / HD) + **global search** (dealers scoped to their own).
- **Application summary:** approved amount, approved-by, **finance company** (+ managed finance-company list).
- **Confirmations area** (completed / pending / issues) + **confirmation script/checklist** + HD confirmation notes + share completed copy to dealer.
- **Notes:** dealer-visible per-deal notes + internal reviewer/Admin-only notes.

### Phase 4 — Notifications, accounts, content & polish ✅ DONE
- ✅ **Dealer profile page** + **email notifications** (log-only, SMTP-ready) + communication-preference toggles.
- ✅ **Reviewer notifications** when new documents are uploaded.
- ✅ Accounts: **forgot-password reset** (single-use, expiring token), **90-day password expiry** with forced change at login, self-service **change password**, and a **recent sign-ins / IP view** on the account page.
- ✅ Content tabs: **Resources**, **HD Promotions**, **HD Credit Card** guide (admin-managed, with file/link/notes); **dealer dashboard announcements**.
- ✅ **Reviewable log** coverage extended (password reset/change, content changes).
- ✅ Cross-cutting: **responsive** nav for phone + PC/Mac; fast server-rendered pages.

> Remaining content is data-only, not code: the **HD Credit Card guide** text and any
> **Resources / HD Promotions** items are added by an admin under Admin → Content when ready.
> **SMS** notifications still need a paid text provider (email works today).

### ⛔ Blocked on info from you (send when ready — won't hold up the phases)
- Home Depot store list per dealer · Finance-company list · Confirmation-call script questions
- HD Credit Card guide content · Final FinanceIt number rule · Legal-reviewed consent wording
- Address-lookup provider (Canada Post vs Google) · SMS text provider (if you want texts, not just email)
