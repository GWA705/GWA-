# Fixes log — go-live testing

A running list of issues found while testing the live portal, and how each was
resolved. Newest at the top. "Live" means deployed to `portal.ghsbarrie.ca`.

| # | Area | Issue found | Fix | Status |
|---|------|-------------|-----|--------|
| 5 | Installed app (PWA) | After a deploy, the iPhone home-screen app kept showing the old version (Safari showed the new one). iOS caches its own snapshot for home-screen apps and nothing told it to refresh. | Added a version watcher: on load and whenever the app regains focus it checks the server's build id and reloads if a newer version is live. Won't reload an active form (checks only on focus, not a timer). | In testing (staging) |
| 4 | Reviewer + dealer | Deal status didn't move on its own, so the dealer couldn't tell where they stood; "Funding submitted" and "In for funding" read as duplicates. | Status now auto-advances as the reviewer works the flow (incl. new "Documents sent — awaiting install"); dealer sees a plain-language "Where your deal stands"; duplicate funding status removed from the manual menu. | Live |
| 3 | Reviewer page | The reviewer screen stacked ~10 sections at once and "didn't flow." | Rebuilt around the real 7-step workflow with a Flow/Tabs toggle (Flow default); current phase opens, done phases collapse, decision controls pinned in a rail. | Live |
| 2 | New application | "Funding submitted" appeared as a manual status option even though it's set automatically and duplicated "In for funding." | Removed from the manual status menu; renamed the underlying state to "Reviewing signed docs." | Live |
| 1 | Deal references | Cash / cheque / credit-card / HD-credit-card deals were blocked for missing a financing number they don't have; GWA deals were asked for an HD Customer # they don't use. | Financing deal # is required only for financed deals; HD Customer # only for HD-program deals. | Live |

## How to add to this list

When something new turns up, add a row at the top with the next number, the
area, what's wrong, and leave Status as "Found" until it's fixed → "In testing"
→ "Live".
