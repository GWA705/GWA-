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

### Search
- [ ] **Global search** by: Loan reference #, Finance reference #, HD reference #, and customer first or last name. ❓ (Requires adding these reference-number fields to each deal.)
- [ ] **Search scoping:** Dealers can only search deals *they* uploaded; Reviewers and Admins can search all deals.

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

### Payouts
- [ ] **Payout receipt / statement per deal:** show the dealer what was paid on the deal. Clickable from the deal so, if there are questions, they can open a receipt/statement of what was paid.

### Confirmation calls (reviewer/confirmer)
- [ ] **HD confirmation notes:** free-text notes the confirmer jots down during a confirmation call (reviewer side).
- [ ] **Confirmation script with checkboxes:** a script of simple questions appears as a checklist; the confirmer checks every box, then clicks **Confirm**. ❓ (Exact script/questions to be provided.)
- [ ] **Share completed confirmation with the dealer:** a copy of the completed confirmation (script + checks) is shown to the dealer too.

### Reviewer ↔ Dealer collaboration & notes
- [ ] **Per-deal note to the dealer:** reviewers can write notes to the dealer; notes live inside that customer's profile (visible to the dealer).
- [ ] **Internal notes (reviewer/Admin only):** a separate per-deal notes area visible *only* to Reviewers and Admins — never shown to dealers.

### New tabs / sections
- [ ] **Resources tab** (top nav, for dealers): a place to upload and share documents/resources dealers can access.
- [ ] **"HD Promotions" tab** (top nav): promotions section.
- [ ] **"HD Credit Card" tab:** a help guide for dealers processing an HD credit card. ❓ Content to be provided later.

### Dealer profile
- [ ] **Dealer profile page** where dealers fill in contact information; that contact info feeds the email notifications.

### Logging
- [ ] **Everything recorded in a reviewable log** (extend the existing audit log to cover uploads, conversions, status changes, notifications, and notes).

---

## Later: organized & prioritized
_We'll fill this in during the "rework" pass once the inbox feels complete._

### Must-have
### Nice-to-have
### Someday / maybe
