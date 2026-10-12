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
- [x] **8. Reports** — LeadsReportView, GiftCardReportView, funding/accounting/custom/forecast/leads/sales-reps, voc, connection/* (Monthly & Weekly views were already translated)
- [x] **9. Remittances** — the whole remittances subsystem
- [x] **10. Confirmations, cancellations, misc** — ConfirmationView, ConfirmationWorklist, cancellations/page, gift-cards/page, find-customer/*, directory/*, mail, staff home, DealerCalculator receipt, StagingBanner (ConfirmationIssueBanner done in batch 5; PromoCard taglines intentionally left English)
- [x] **11. Server-action messages** — dealer/staff actions.ts return strings shown via `{state.error}`/toasts (actionMsg.*)

---

## ✅ Sweep complete (2026-10-12)
All batches landed. New dict groups: `rec, dlrDocs, chatUi, convoUi, noteUi, dealParts,
leadUi, staffCards, editForm, reviewerEntry, resolution, staffDeal, remit, staffMisc,
actionMsg, reportsUi` + `shell/nav/notifications/progress/coApp` + `common.*` extensions.
The `tests/i18nKeys.test.ts` guard keeps every `t()` key present in both en.ts and fr.ts.

**Known remaining (by design / follow-up):**
- PromoCard brand taglines — left English pending official FR taglines from the brand kit.
- Monthly/Weekly snapshot report views were already translated before this sweep.
- Some deep lib-produced strings (zod validation details, constants' STATUS_LABELS, CPA/consent
  verbatim legal text) are intentionally not routed through t().
- French is translator-quality draft; a native QC-French reviewer pass is recommended before
  relying on it for a formal audience.

## Decisions needed / taken
- Confirmation-call checklist (ConfirmationView, 6 items): treated as an internal
  reviewer call script (NOT the verbatim CPA consent text) → translated.
- PromoCard taglines: left English pending official FR taglines from the brand kit.

_Progress is committed per batch; this list is ticked as each lands._
