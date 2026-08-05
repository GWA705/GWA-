# Fixes log — go-live testing

A running list of issues found while testing the live portal, and how each was
resolved. Newest at the top. "Live" means deployed to `portal.ghsbarrie.ca`.

| # | Area | Issue found | Fix | Status |
|---|------|-------------|-----|--------|
| 9 | Tax exemption (Indigenous status) | No way to handle full/parts tax exemption for status First Nations customers; need to capture band number and remind dealer + reviewer before final HD payment. Rules vary federally vs. by province. | Needs research (per-province + federal point-of-sale exemption rules), then: capture status + band #, flag the deal, and gate/ remind before payout. | Researching / to scope |
| 8 | Application intake | No minimum age — an under-18 applicant could be submitted for approval. | Applicant (and co-applicant) must be at least 18; enforced server-side and the DOB picker won't allow an under-18 date. | In testing (staging) |
| 7 | Date entry (mobile) | Entering a birthdate / dates is slow on mobile. | DOB picker now caps at 18-years-ago so it opens near a plausible birth year. Further speed-ups (fast typed entry) still to design. | Partial — more to do |
| 6 | Dealer → reviewer upload | Per-document drag-and-drop cards are clunky and slow on a phone. | Design a faster mobile-first upload (single multi-file dropzone + camera capture, auto-sorted). | To design |
| 5 | Installed app (PWA) | After a deploy, the iPhone home-screen app kept showing the old version (Safari showed the new one). iOS caches its own snapshot for home-screen apps and nothing told it to refresh. | Added a version watcher: on load and whenever the app regains focus it checks the server's build id and reloads if a newer version is live. Won't reload an active form (checks only on focus, not a timer). | In testing (staging) |
| 4 | Reviewer + dealer | Deal status didn't move on its own, so the dealer couldn't tell where they stood; "Funding submitted" and "In for funding" read as duplicates. | Status now auto-advances as the reviewer works the flow (incl. new "Documents sent — awaiting install"); dealer sees a plain-language "Where your deal stands"; duplicate funding status removed from the manual menu. | Live |
| 3 | Reviewer page | The reviewer screen stacked ~10 sections at once and "didn't flow." | Rebuilt around the real 7-step workflow with a Flow/Tabs toggle (Flow default); current phase opens, done phases collapse, decision controls pinned in a rail. | Live |
| 2 | New application | "Funding submitted" appeared as a manual status option even though it's set automatically and duplicated "In for funding." | Removed from the manual status menu; renamed the underlying state to "Reviewing signed docs." | Live |
| 1 | Deal references | Cash / cheque / credit-card / HD-credit-card deals were blocked for missing a financing number they don't have; GWA deals were asked for an HD Customer # they don't use. | Financing deal # is required only for financed deals; HD Customer # only for HD-program deals. | Live |

## How to add to this list

When something new turns up, add a row at the top with the next number, the
area, what's wrong, and leave Status as "Found" until it's fixed → "In testing"
→ "Live".
