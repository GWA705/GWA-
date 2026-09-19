# Blank lead-card reference (optional, makes the scanner more accurate)

Drop a **clean, blank, unfilled** photo of the Home Depot water-test lead card in
this folder and the lead-card scanner will use it as a layout map — "here is where
each field and tick-box sits" — before reading each filled photo. On busy or messy
cards this measurably improves what it reads.

This is **optional**. With nothing here, the scanner works exactly as it does now.

## How to add it

1. Photograph or scan **one empty card** — no customer writing on it. A flat,
   straight, well-lit shot of the whole card is best.
2. Name the file **`blank-card.jpg`** (or `.jpeg`, `.png`, `.webp`) and put it in
   this folder (`assets/lead-card/`).
3. Commit it. The scanner picks it up automatically on the next deploy — nothing
   else to configure.

> Not sure how to commit a file? Send the blank-card photo to Claude in a portal
> session and ask it to add the reference card — it will drop it in here for you.

## Optional: layout notes

If part of the card is easy to misread (e.g. the store-number box, or a tick-box
that's laid out oddly), add a plain-text file named **`notes.txt`** in this folder
with short hints in your own words. The scanner is told to trust these over its own
read of where things sit. Keep it to real, specific hints — leave the file out
entirely if you have none.

## Turning it off

Set the environment variable `LEAD_CARD_TEMPLATE_DISABLED=1` on the server to make
the scanner ignore everything in this folder, without deleting anything.
