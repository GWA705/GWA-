# French (i18n) audit & remediation — tracking

**Why:** the EN/FR toggle is live for dealers and staff, but ~95 files held ~650
user-visible English strings that never went through the translation system, so
they showed in English even in French mode. This file tracks the batch-by-batch
fix. (Audit run 2026-10-12.)

**How we translate:** server components `const t = getT()` (`@/i18n/server`);
client components `const t = useT()` (`@/i18n/client`); render `t('group.key')`
with `{var}` interpolation. Keys live in BOTH `src/i18n/dictionaries/en.ts` and
`fr.ts` — `fr: Dictionary` makes tsc fail if any key is missing in French, so
nothing silently falls back to English. Shared high-frequency strings live in the
`common.*` group.

**Out of scope (English by design):** the admin console (`(admin)/**`), the
dealer tutorial, the verbatim Consumer Protection Act / consent legal text, and
the public standalone pages (`/sms`, `/privacy`, `/book`). Brand name "Georgian
Water & Air" and brand taglines (PromoCard) stay as the brand kit defines.

## Batches

- [x] **0. Shared `common.*`** — Save/Cancel/Search/Sort/Loading…/Saving…/etc. (done first; underpins the rest)
- [x] **1. Shell, nav, notifications** — AppShell, TopNav, MobileNav, NotificationBell, NotificationsFeed, dealer+staff notifications pages
- [x] **2. Dealer documents & recordings** — documents/page, DocumentManager, DocumentList, recordings/page
- [x] **3. Chat & notes** — ChatWidget, ConversationThread, NoteForm
- [x] **4. Leads** — CombinedLeadsControls, DealerListControls, ScanLeadCard, ScannedLeadEditForm, ScannedLeadsList, AllLeadsView, LeadsView, MailInTestWorkspace, SearchBox, QueueSortControl, MorningCatchUp
- [x] **5. Deal-detail shared components** — PayoutReceipt, SerialNumberForm, ProductSerialForm, PaperworkCards, ProductPicker, FundingItemUploader, misc small buttons (Download/Ocr/Verify/etc.)
- [x] **6. Staff deal-detail** — staff/applications/[id]/page.tsx, EditDealForm, ReviewerEntryView, colocated cards (Cancellation/EmailDocs/FlagIssue/ReviewRequest/FundingStep/etc.)
- [x] **7. Resolutions subsystem** — resolutions/page, [id]/page, CaseContactCard, NewCaseForm, CaseControls, CaseEmailThread, LinkDealControl, CaseAttachments, WatchEmailsControl, HdReplyDrafter, inbox/new
- [ ] **8. Reports** — LeadsReportView, GiftCardReportView, funding/accounting/custom/forecast/leads/sales-reps/weekly, voc, connection/*
- [ ] **9. Remittances** — the whole remittances subsystem
- [ ] **10. Confirmations, cancellations, misc** — ConfirmationView, ConfirmationWorklist, ConfirmationIssueBanner, cancellations/page, gift-cards/page, find-customer/*, directory/*, PromoCard (taglines TBD), StagingBanner
- [ ] **11. Server-action messages** (secondary) — dealer/staff actions.ts return strings shown via `{state.error}`/toasts

## Decisions needed / taken
- Confirmation-call checklist (ConfirmationView, 6 items): treated as an internal
  reviewer call script (NOT the verbatim CPA consent text) → translated.
- PromoCard taglines: left English pending official FR taglines from the brand kit.

_Progress is committed per batch; this list is ticked as each lands._
