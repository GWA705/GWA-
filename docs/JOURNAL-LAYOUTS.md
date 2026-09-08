# Sales-journal sheet layouts (for reference)

Captured 2026-09-08 from the live Google Sheets. The journal **layout changed
between years** (and, per Sean, again partway through 2025), so the reader
(`src/lib/reporting/journalRead.ts`) matches columns by **header text**, never by
position. This file records the real headers so we can add/adjust candidates
without opening the sheets.

> **Key point for the Salesperson leaderboard:** the rep column is headed
> **"Dealer's Name"** in BOTH books below — only its *position* moves (N in 2024,
> Q in 2025). Because the reader matches by header, `journalRead.ts`'s
> `salesperson: ["dealer's name", …]` candidate already captures it in both years.
> The two-row header combines to `dealer's name` in each.

---

## 2024 — "GHS-AIR&WATER SALES JOURNALS 2024"
Sheet id `1jAnCn2VbfO-2CYfbncYbJJXLFUi2LxS99b1qX_qYTd4`. Older layout: a
metadata block in rows 1–3 (Distributor / Office / Month) and a **two-row header**
in rows 4–5. Month per tab (March 2024 shown).

| Col | Header (row4 / row5) | Notes |
|---|---|---|
| A | No. | |
| B | Date | sale date |
| C | Customer's / Last Name | |
| D | Customer's / First Name | |
| E | HD Ref # | |
| F | HD Store | ⚠️ holds a **CITY name** ("PARRY SOUND", "SUDBURY"), NOT a 4-digit store number — the 2024 store→number resolver in `journalImport.ts` handles this |
| G | Address | |
| H | City/Town | |
| I | Province | |
| J | Postal Code | |
| K | Phone No. | |
| L | Booking Secretary | |
| M | Lead Generator | |
| **N** | **Dealer's / Name** | **← salesperson / rep** |
| O | Installer's / Name | |
| P | Date Installed | |
| Q | Installation Fees | |
| R | Deal Result | OK / PE/OK / RB |
| S | Product Sold and any gifts | comma-separated product codes |
| T | # of Units Sold | |
| U | Comments | often the store city again |
| V | Dealer Profit | |
| Y | Pay Dealer On This Amount | |
| AC | Cust. Rebate Amt. / Premium Gift Cost | |
| AD | Net Sale | |
| AE | HST Collected | |
| AF | ACCOUNT REC'BLE | ← gross basis (`grossAmount`) |
| AG | Cash/Chq /CC Amount | |
| AH | Credit Card Discount | |
| AJ | Financed Amount | |
| AK | Who Financed | HDFINIT / HDFIN / UEI … |
| AP | Amt. Paid By Finance Co. | |
| AQ | Date Paid | settlement date (`datePaid`) |

(Columns W, X, Z, AA, AB, AI, AL–AO are hidden/calculated.)

---

## 2025 (Jan–~Jun) — "GHS -WATER & AIR - SALES JOURNAL 2025"
Sheet id `1WYqNipTSPfW8upqTokMfnVG2RyVqNtHF2HbiVE5qJ4s`. Metadata rows 1–3
(+ a colour legend), **two-row header** rows 4–5. January 2025 shown.
**The columns were rearranged partway through 2025 — see the July layout below.**

| Col | Header (row4 / row5) | Notes |
|---|---|---|
| A | No. | |
| B | Date | sale date |
| C | Customer's / Last Name | |
| D | Customer's / First Name | |
| E | HD Ref # | |
| F | HD Store | "CITY - NUMBER" e.g. "BARRIE - 7024", "BRADFORD - 7264" (number present, unlike 2024) |
| G | Address | |
| H | City/Town | |
| I | Prov. | |
| J | Postal Code | |
| K | Phone No. | |
| L | Location | e.g. "BARRIE" (office label) |
| M | # of Units Sold | |
| N | Product / Sold and any gifts | |
| O | Booking Secretary | |
| P | Lead Generator | |
| **Q** | **Dealer's / Name** | **← salesperson / rep** |
| R | Installer's / Name | |
| S | Date Installed | |
| T | Deal Result | OK / PE/OK / RB |
| U | Net Sale | |
| V | HST Collected | |
| W | ACCOUNT REC'BLE | ← gross basis (`grossAmount`) |
| X | Cash/Chq /CC Amount | |
| Y | PMT Type | |
| Z | Financed Amount | |
| AA | Who Financed | HDFINIT / HDUEI / GHSFINT / CC … |
| AB | HD Discount | |
| AC | Amt. Paid By Finance Co. | |
| AD | Date Paid | settlement date (`datePaid`) |
| AE | Balance Of Sale | |

---

## 2025 (~Jul onward) — same 2025 sheet, columns rearranged
Sean rearranged the columns partway through 2025 (July tab shown). **Big reshuffle
from January**, but the reader still copes because it matches by header text. The
rep column **"Dealer's Name" is still present** (now column S). Contact/address
fields moved to the far right; several new columns were added (Financed Co. Loan #,
WHOSE AMEX, SOAP Included, REBATE AMOUNT, HD Discount, Balance Of Sale).

| Col | Header (row4 / row5) | Notes |
|---|---|---|
| A | No. | |
| B | Date | sale date |
| C | Customer's / Last Name | |
| D | Customer's / First Name | |
| E | HD Ref # | |
| F | How They / Payed | payment/finance code (HDFINIT, HDCC, HDUEI, CC…) — reader's `payedType` |
| G | HD Store | "CITY - NUMBER" |
| H | Financed Co. / Loan # | loan number (NOT the finance company) |
| I | Financed / Term(s) | |
| J | Cash/Chq /CC / Amount | |
| K | Financed / Amount | |
| L | WHOSE / AMEX | |
| M | Date / Paid | (an AMEX-settlement date; see Q) |
| N | Location | office label ("BARRIE") |
| O | # of Units Sold | shown as "UNITS" |
| P | Deal / Result | OK / PE/OK / RB |
| Q | Date / Paid | settlement date (`datePaid`) — reader picks the "paid" col AT/AFTER Result |
| R | Lead Generator | |
| **S** | **Dealer's / Name** | **← salesperson / rep** |
| T | Installer's / Name | |
| U | Product / Sold and any gifts | |
| V | SOAP Included | |
| W | REBATE AMOUNT | |
| X | Address | |
| Y | City/Town | |
| Z | Prov. | |
| AA | Postal Code | |
| AB | Phone No. | |
| AC | Booking Secretary | |
| AD | Date Installed | |
| AE | Net Sale | |
| AF | HST Collected | |
| AG | ACCOUNT REC'BLE | ← gross basis (`grossAmount`) |
| AH | HD Discount | |
| AI | Amt. Paid By Finance Co. | |
| AJ | Balance Of Sale | |

> The two `Date Paid` columns (M and Q) are why the reader deliberately picks the
> "paid" header **at or after** the Result column — Q, the real settlement date.

---

## Header → reader-field mapping (the constant)
Regardless of position, `journalRead.ts` matches these header substrings:
`Last Name`, `First Name`, `HD Ref`, `HD Store`, `Location`, **`Dealer's Name` → salesperson**,
`Sold and any gifts`/`Product`, `Result`, `Paid` (date paid), `Who financed`/`Payed`/`Type`,
`Account`/`Rec'ble`/`Sale` (gross), `Amt paid by` (net). Because it's header-based,
moving columns between years is fine; **renaming** a header is what would break it.
