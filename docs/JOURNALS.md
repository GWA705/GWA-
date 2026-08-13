# Sales journals — how the portal reads & writes them

The portal both **writes** approved deals into the Google Sheets sales journal
and **reads** the journals to build the reporting area. Both are keyed by year.

## The one rule: one env var per year

Each calendar year has its own journal spreadsheet. The portal finds it from an
environment variable named by year:

```
JOURNAL_SHEET_ID_2024 = <2024 journal spreadsheet id>   # older, different layout — see below
JOURNAL_SHEET_ID_2025 = <2025 journal spreadsheet id>
JOURNAL_SHEET_ID_2026 = <2026 journal spreadsheet id>   # falls back to JOURNAL_SHEET_ID
JOURNAL_SHEET_ID_2027 = <2027 journal spreadsheet id>
```

The spreadsheet id is the part of the sheet URL between `/d/` and `/edit`.

### The 2024 book has a different layout — and that's handled

The old 2024 journal isn't laid out like the newer ones: it has a metadata block
at the top of each tab (`Distributor:` / `Office:` / `Month:`), a **two-row**
column header, and **no "Location" column**. The reader detects all of this
automatically:

- Tabs are recognized even when named just `MARCH` / `Mar-24` / `March '24`
  (not only `March 2024`).
- Columns are matched by their header text, so the different column order still
  maps correctly (name, phone, HD Ref #, HD Store, address, product, amounts,
  Date Paid).
- With no Location column, the office is read from the `Office:` metadata line so
  attribution still works.

So the only thing to do for 2024 is set `JOURNAL_SHEET_ID_2024` and share the
sheet with the service account — no code change. It then shows up on the Journal
connection + System health checks and is included in the customer/journal search.

`JOURNAL_SHEET_ID` (no year) is the legacy/base id and is also used as the
**test** journal (see write modes below). For 2026 it's the automatic fallback
when `JOURNAL_SHEET_ID_2026` isn't set.

## Every new year — the whole checklist

When a new year's journal is created in Drive:

1. **Share** the new sheet with the service-account email (Viewer is enough).
   Find that email on **Reports → Journal connection** (copy button).
2. **Add** `JOURNAL_SHEET_ID_<year>` in Render → your service → Environment, set
   to the new sheet's id. Save (Render redeploys).
3. **Verify** on **Reports → Journal connection**: the new year's row should show
   🟢 Connected with the right title and month-tab count.

That's it. No code change. Reporting picks the year up automatically (it always
reads the current year + the previous year for comparisons), and — in Live write
mode — deals write to the correct year's journal by their sale date.

## Write modes (test vs live)

**Reports → Journal connection** has an admin toggle for where the *Write to
Journal* button saves deals:

- **Test** (default): every write goes to the single test journal
  (`JOURNAL_SHEET_ID`). A safe sandbox — reports never read it.
- **Live**: each deal writes to its **own sale-year** journal
  (`JOURNAL_SHEET_ID_<year>`). A 2027-dated deal writes to the 2027 journal, a
  2026 deal to the 2026 journal — no per-year switch needed.

Reporting **always** reads the live per-year journals, regardless of this toggle.
So you can read real numbers while deals still land in the test sheet, then flip
to Live for a one-click cutover.

## Store names in reports

Reports label each HD store as `<number> — <name>` (e.g. `7024 — Barrie`). The
name comes from **Admin → Dealers** (the store's name field) when set; otherwise
it's derived from the journal's own "HD Store" column, so names appear even
before anyone fills them in. Set clean names in Admin → Dealers to override.

## Attributing journal sales to an office

A report attributes a journal row to an office by matching the journal's HD store
number to the **Home Depot store numbers assigned to that dealer** in
Admin → Dealers. Keep each office's store-number list current so its sales roll
up correctly.
