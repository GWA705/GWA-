# GWA Dealer Portal — Unfinished / open items

Durable checklist of work that's parked, backlogged, or waiting on external
config. Read this alongside `CHANGELOG.md` and `BUILD-FACTS.md`. Tick items off
(and add a dated note) as they land; move shipped work into `CHANGELOG.md`.

_Last reviewed: 2026-09-08._

## Waiting on you — operational (needs live DB / AWS / Render access)

- [x] **Import past-year journals (2024, etc.)** — reported COMPLETE by Sean
  (2026-09-08). Tooling: Reports → Connection archive controls; city-name→store
  resolver. Current year stays a live read. _Can't verify from the agent
  environment — production is AWS RDS (ca-central-1), not reachable here; verify
  in-app via the Connection page archive status + an every-office customer
  search for a past-year customer._
- [ ] **Guusto gift-card API** — parked. Awaiting `GUUSTO_API_TOKEN` in Render +
  exact field names (test at `/admin/guusto-test`) + office→reason mapping.
- [ ] **Turn on the licence photo scan** — the barcode scanner was removed
  (2026-09-08), so "Scan driver's licence" is now photo→Textract **AnalyzeID**
  only. AnalyzeID may not be offered in `ca-central-1`; if the scan says "isn't
  switched on," set **`TEXTRACT_ID_REGION`** (e.g. `us-east-1`) in Render and
  redeploy. Data-residency tradeoff: a US region processes the licence image in
  the US (never stored). See `docs/ID-SCAN.md`. _Decision + env set needed._

## Done recently

- [x] **Office phone + address on the customer-search card** (item 2) — DONE
  2026-09-08. The selling office's saved address now shows next to its phone on
  the journal "office to contact" card and the dealer cross-office card. Address
  comes from `DealerProfile.address` (Dealer → Profile → Business address).

## Backlog — planned, not built

- [ ] **Messenger: multiple support conversations** (schema + backend). _Saved
  2026-09-08 (Sean)._ (task #12)
- [ ] **Messenger: tabbed widget shell** (Home / Messages / Help / News). _Saved
  2026-09-08 (Sean)._ (task #13)
- [ ] **In-app Tutorial / walk-through** — intentionally on hold (separate from
  the Welcome tour, which is done and bilingual).

## French (fr-CA) — draft is broad; residuals remain _(saved 2026-09-08, Sean)_

- English **by design**: internal admin console; the verbatim Consumer Protection
  Act consent text (Québec team supplies the FR); shared enum/decision labels used
  by staff + email.
- English **still to do** (low traffic): staff gift-cards page, the mail-attachment
  viewer, one or two report-wrapper labels.

## Recently built — needs a real-device / production pass (Sean verifying)

- [ ] **Scan-verification gate** (confirm each scanned section before submit).
- [ ] **Live driver's-licence camera scan** reliability.
- [ ] **iOS zoom fix** on message composers + **full-height sidebar** (verify
  after a cache clear).
