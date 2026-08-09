# Bulk parts-catalog import — build spec

Status: **planned (not built)**. This is the design to build from when ready.

## Goal
Let an admin populate/update the marketplace catalog in bulk from a spreadsheet
(+ images), instead of adding items one at a time. Matches on **part number** so
re-uploading an updated sheet updates existing items rather than duplicating them.

## Who / where
- Admin-only, under **Admin → Marketplace** (`marketplace` admin section).
- Reuses the existing `MarketplaceItem` model and image pipeline — no new
  customer-facing surface.

## User flow
1. Admin downloads a **template** (CSV/XLSX with the columns below, one example row).
2. Admin fills it in and (optionally) prepares an **image ZIP**.
3. Admin uploads the sheet (+ ZIP) → the importer parses and shows a **dry-run
   preview**: "42 new · 8 updated · 3 rows with errors" with a per-row error list.
4. Admin clicks **Import** to apply. Nothing changes until this confirm step.

## Spreadsheet columns
Accept CSV and XLSX. Header row required; column matching is case-insensitive.

| Column | Required | Notes |
|---|---|---|
| `Part number` | Yes | Upsert key. Unique per item. Trimmed. |
| `Name` | Yes | Title-cased on import (existing textcase rules). |
| `Description` | No | Sentence-cased on import. |
| `Category` | No | Matched by name; **auto-created** if new (configurable). Blank = Uncategorized. |
| `Options` | No | Comma-separated sizes/options, e.g. `S, M, L, XL`. |
| `Tags` | No | Comma-separated from the fixed set: New, Sale, Clearance, Popular. Unknown tags ignored. |
| `Image` | No | File name in the ZIP (or a URL — see below). Defaults to `<Part number>.jpg/png` if blank. |
| `Sort order` | No | Integer; default 0. |
| `Active` | No | `yes/no` / `true/false`; default yes. |
| `Type` | No | `ORDER` (default) or `DOWNLOAD`. |

## Images — two supported modes
- **ZIP by part number (recommended):** upload a ZIP; each row's image is matched
  to `<Image>` (or `<Part number>.<ext>`). Unmatched rows import without a photo
  and are listed in the preview. Reuses the current resize (sharp) + encrypted
  storage path.
- **Image URL column:** the importer fetches each URL server-side (with size/type
  limits) and stores it the same way. Slower; good when photos live elsewhere.

## Matching / upsert rules
- Key = `Part number` (case-insensitive, trimmed).
- Existing item with that part number → **update** its fields; keep its current
  photo unless a new one is supplied.
- No match → **create**.
- A row with a blank part number → error (can't upsert safely).
- Duplicate part numbers **within the file** → error on the later rows.
- Optional switch: "**Deactivate items not in this file**" (off by default) to
  sunset discontinued parts in one pass.

## Validation & safety
- Dry-run preview first; import runs in a transaction (batched) so a mid-file
  failure doesn't leave a half-applied catalog.
- Per-row errors are reported with row numbers; valid rows can still be imported.
- File-size limit on the sheet and ZIP; images capped per current upload limits.
- Admin-only; every import is written to the audit log (counts + filename).

## Data-model impact
- No new model. **Add a unique index on `MarketplaceItem.partNumber`** (nullable
  unique — Postgres allows multiple NULLs) so upsert is reliable. One migration.
- Optionally record `lastImportedAt` / `importBatchId` for traceability.

## Tech approach
- Parsing: `xlsx` (SheetJS) for .xlsx, `papaparse` for .csv (or `xlsx` for both).
- ZIP: `unzipper` / `adm-zip` (pure JS).
- Images: existing `sharp` resize + `storage.putDocument` (encrypted at rest).
- Server action `importCatalogAction` + a small admin UI (upload → preview → confirm).
- Idempotent by design (re-run safe).

## Effort
- ~Small–medium. Phase 1: CSV/XLSX + upsert + dry-run (no images). Phase 2: image
  ZIP matching. Phase 3: URL images + "deactivate missing" switch.

## Out of scope (future)
- Pricing, inventory/stock counts, customer-facing catalog, per-dealer catalogs.
- A separate larger "order catalog" app — would reuse this import engine + the
  Order/OrderItem flow, but is its own project.
