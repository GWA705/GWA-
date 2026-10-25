# Plan: portal ↔ booking, per dealer location

**Status:** design / discussion. Draft 2026-10-24; **decision reached 2026-10-25
— go with B** (see below) after the booking side's reply
(`gwa705/gwa-webiste-`, `docs/PORTAL-MULTITENANT-RESPONSE.md`). Nothing built yet.
Today everything goes to **one** booking site; this describes how the portal talks
to **each dealer's** booking as we expand.

---

## DECISION (2026-10-25): B — one multi-tenant booking app (tenant = Office = dealer)

The booking side's reply makes the call clear: **B, not A.** Booking already has an
`Office` model that owns its users, leads and appointments, with `officeId` threaded
through the schema — so B is "finish the existing tenant seam," while A would mean N
deployments + N databases + N secrets + N catalogs. Each dealer still gets "their own
site" via a **branded subdomain pointing at the one booking app**; data is isolated by
office inside it. Agreed.

**B makes the _portal_ side much simpler than the A design below:**

- **No** per-dealer `BookingSite` model, **no** per-dealer URL/token storage, **no**
  encrypted-token admin UI. The portal keeps the **one** `BOOKING_INTAKE_URL` +
  `PORTAL_INTAKE_TOKEN` it already has.
- The portal's whole job becomes: **tag every payload with the dealer**, and **scope
  inbound booking data by that dealer**.

### The contract — the dealer key
- The portal adds **`dealerId` = the portal's `Dealer.id`** (stable, unique) to **every**
  outbound payload (lead push, status sync, sold-customer push), plus `dealerName` (and a
  short `dealerCode` if booking wants one) so booking can create/label the `Office` the
  first time.
- Booking stores it as `Office.portalDealerId` (unique) and resolves dealer → office on
  intake. Unknown / not-accepting dealer → **skip, never default to Georgian** (mirrors
  our "null → skip, no fallback" rule). `storeNumber` stays supplementary; `dealerId` is
  authoritative.

### Back-channel — converge on what already exists
Booking already posts lead status to the portal's **existing `/api/intake/booking-status`**
(`{applicationId, status}`, Bearer `PORTAL_INTAKE_TOKEN`); the portal receives it and
writes `bookingStatus`/`bookingStatusAt`. There's also `/api/intake/office-summary`. So we
**drop the proposed new `/api/intake/booking/...` path** and instead **extend the existing
`/api/intake/*` endpoints** for the richer booking → portal events (appointment outcomes,
install/service, opt-out), keyed on `applicationId` (+ phone blind index) and scoped to
that application's dealer.

### ✅ Implemented 2026-10-25 — the dealer tag booking asked for
Every portal → booking payload now carries a **dealer tag**, so booking can map it to an
`Office`. Resolved by a cached `dealerTag(dealerId)` (`src/lib/bookingPush.ts`) and added to
**all three feeds + both backfills** (scanned-lead push, status sync, sold-customer push):

```jsonc
{
  "dealerId":   "<portal Dealer.id>",   // authoritative key → Office.portalDealerId (null = skip, never default)
  "dealerName": "Georgian Water and Air", // = Dealer.name, for labelling the office
  "dealerCode": "GWA"                      // = Dealer.journalName (may be null)
}
```
These sit alongside the existing fields on `/api/intake/portal` (leads), `/api/intake/portal-status`
(status), and `/api/intake/portal/sold` (sold customers). No behaviour change for the single-site
setup today — booking can start reading `dealerId` whenever it's ready. **Booking side:** add
`Office.portalDealerId` (unique) and resolve `dealerId` → office on intake.

### Portal-side task list (B)
1. ✅ Add the dealer tag to the three outbound payloads (done — see above).
2. Extend inbound `/api/intake/*` to accept appointment outcomes / install + service /
   opt-out from booking, attach to the Application/customer, scoped by applicationId →
   dealer; mirror opt-out back to booking.
3. Keep the **SKU contract**: portal journal-name == booking `Product.sku` (already how
   sold-customer product matching works). Unchanged.
4. **Not** needed under B: the `BookingSite` model, per-dealer tokens, portal-side host
   routing (all A-only — see the reference design below).

### Still to confirm with the booking side (before building)
- Exact field names / a small shared schema for the richer back-channel events.
- Whether a human-readable `dealerCode` is wanted alongside `dealerId`.
- Opt-out semantics both ways (what counts as "stop", and precedence).

_The design below was written for A and is kept for reference; under B its per-dealer-site
parts don't apply._

---

## The goal (in plain terms)

Today Georgian Water & Air has a booking site (`office.ghsbarrie.ca`). As we grow,
**each dealer location gets its own booking site**, just like Georgian's. The
credit portal (`portal.ghsbarrie.ca`) is shared by all dealers, and it needs to
**flow information to and from the right dealer's booking site** — never mixing
one dealer's data into another's.

## What exists today (one site, global wiring)

The portal → booking link is already live for Georgian, wired with **two global
env vars** on the portal:

- `BOOKING_INTAKE_URL` = `https://office.ghsbarrie.ca/api/intake/portal`
- `PORTAL_INTAKE_TOKEN` = shared secret (matches the booking app)

Three feeds run over that single target (`src/lib/bookingPush.ts`, `src/lib/bookingSold.ts`):

| Feed | What it sends | Endpoint (derived from `BOOKING_INTAKE_URL`) |
|---|---|---|
| Scanned leads → call board | new scanned leads | `…/api/intake/portal` |
| Status sync | a lead's coarse status (new/working/booked/sold/nogood) | `…/api/intake/portal-status` |
| Sold customers → household | funded deals as customers; cancellations reverse | `…/api/intake/portal/sold` |

**The gap:** these resolve to **one** URL/token for **every** dealer. So right now
all funded deals (whatever dealer sold them) land in Georgian's booking site. Fine
while Georgian is the only booking site; wrong the moment a second dealer has one.

## The one question that decides the whole design

**Is each dealer's booking site a _separate_ app/deployment+database, or is booking
_one_ multi-tenant app (one deployment, tenanted by dealer internally)?**

The user's intent ("they'll all have a different site like Georgian has, but their
own") points to **separate sites**. But this is the first thing to confirm with the
booking-side Claude, because it changes everything:

- **A) Separate sites per dealer** (one booking deployment + DB each). The portal
  must hold a **per-dealer URL + token** and route each dealer's data to their own
  site. (This doc assumes A.)
- **B) One multi-tenant booking app** (one URL, tenanted by dealer). The portal
  keeps **one** URL but **tags every payload with the dealer**, and booking routes
  internally. Simpler for the portal; the complexity moves to booking. Many fewer
  moving parts (one token, one deploy, one catalog) — worth seriously considering.

**Recommendation to discuss:** B is materially simpler to operate (one place to
deploy, one secret, one product catalog, one backup story) and still keeps dealers
isolated inside booking. A matches "their own site" literally and gives each dealer
hard infrastructure separation. The right answer depends on how separate the
booking sites really need to be (branding/domain only, vs. fully independent data
and ops). The rest of this plan works for **A**; the "B" column notes what changes.

## Target design (assuming A — separate sites)

### 1. A per-dealer booking config

Add a record that maps a dealer → their booking site. Two shapes, pick one:

- **Simplest:** fields on `Dealer` — `bookingIntakeUrl String?`, `bookingIntakeTokenEnc String?` (encrypted), `bookingEnabled Boolean`.
- **Cleaner/extensible (recommended):** a new `BookingSite` model, one per dealer:
  `dealerId` (unique), `intakeUrl`, `intakeTokenEnc` (encrypted with the portal's
  existing `crypto` helpers — never plaintext), `enabled`, `lastLeadAt`,
  `lastSoldAt`, `notes`. Room later for per-site health, catalog mapping, etc.

Tokens are secrets → **store encrypted** (`encryptString`/`decryptString` already
exist in the portal), entered via an **admin UI** (per-dealer booking settings).
Each booking site generates its own token on its side; the portal stores it.

### 2. Route by the deal's dealer

The push helpers currently read the global env. Change them to resolve a target
from the deal's dealer:

```
bookingTargetForDealer(dealerId) -> { url, token } | null
```

- Resolved target set → send there.
- **`null` (dealer has no booking site yet) → skip.** Do **not** fall back to a
  default — that is exactly the cross-dealer leak we must avoid. A dealer's deals
  simply wait until their site exists.
- Transition aid: keep the **global env as a legacy fallback _only_ for Georgian's
  dealer id** while we migrate, then remove it once Georgian has a `BookingSite`
  row like everyone else.

Every push already carries the deal's `dealerId` (via the `Application`), so this
is a lookup change, not a rewrite. `bookingPush.ts` / `bookingSold.ts` take a
resolved `{url, token}` instead of reading env directly.

### 3. Per-dealer backfill

The "Send sold customers to booking" sweep becomes **per dealer**: group funded
deals by `dealerId` and send each group to that dealer's site. Only dealers with a
configured, enabled site are swept. (Today's single-site backfill already ran for
Georgian; see CHANGELOG.)

### 4. Tenant isolation (the rule we must not break)

- Each site has its **own token**. The portal sends a dealer's data **only** to
  that dealer's site.
- For the **reverse** direction (below), the booking site authenticates as its
  dealer (its own token), and the portal **scopes every incoming write to that
  dealer** — a site can never read or write another dealer's records.

## Both directions (the portal ↔ booking flow)

### Portal → booking (mostly built; needs per-dealer routing)
Leads, status, sold customers — as today, but routed per dealer.

### Booking → portal (new; to define with the booking Claude)
What should flow back, so a portal customer profile reflects booking activity?
Candidates to discuss:

- **Appointment / demo outcomes** (booked, ran, sold / didn't, sale amount) back
  onto the portal lead/customer.
- **Service & install history** shown on the portal customer/household.
- **Do-not-contact / opt-out** changes mirrored both ways.

Mechanics (proposed): a **portal intake endpoint** (e.g. `…/api/intake/booking/...`)
that each booking site calls, authenticated with that dealer's shared token, with
the **portal scoping every write to that dealer**. Mirror of the booking intake we
already have in the other direction. Dedup on stable keys shared by both systems
(`applicationId`, phone blind index).

## Cross-cutting things to settle

- **Product catalog / SKUs.** The sold-customer sync matches products by SKU
  (= the portal's journal name / booking's `Product.sku`). Each separate booking
  site has its **own** catalog — so either each site mirrors the portal catalog
  (per-site sync, as #92 does for one), or (option B) one shared catalog. Decide
  how catalog sync works per dealer.
- **Token provisioning.** How does each new booking site's token reach the portal —
  admin paste, or an automated handshake at site creation?
- **Shared dedup keys.** Keep `applicationId` and the phone blind index consistent
  across systems so re-sends never double and the two sides can reconcile.
- **Onboarding a new location** becomes: create the dealer's booking site →
  generate its token → enter URL+token in the portal's booking settings → run that
  dealer's backfill. A short runbook once the shape is fixed.

## Rollout (once the shape is agreed)

1. Add the booking-config model + admin UI (encrypted token).
2. Migrate Georgian from the global env to a `BookingSite` row (no behaviour
   change — same URL/token).
3. Switch the push helpers to resolve per-dealer target; keep the Georgian-only env
   fallback during the transition, then drop it.
4. Make the backfill per-dealer.
5. Define + build the booking → portal direction.
6. Per new location: provision site, enter config, backfill. Document the runbook.

## Open questions for the booking-side Claude

1. **Separate sites per dealer (A) or one multi-tenant booking app (B)?** (Decides
   everything above.)
2. If A: how is each site's **intake token** generated and handed to the portal?
3. What data should flow **booking → portal**, and at what granularity/timing?
4. **Product catalog** per dealer — per-site mirror of the portal catalog, or
   shared? How do SKUs stay aligned so sold-customer product matching works?
5. Any dealer whose booking site should **not** receive portal leads/customers
   (e.g. a site that only does service)?

---

_Portal-side code this touches: `src/lib/bookingPush.ts`, `src/lib/bookingSold.ts`,
`src/app/(dealer)/.../scanActions.ts` (lead push), the admin booking-settings UI
(new), and the backfill action/button. No portal data model exists for this yet —
that's step 1._
