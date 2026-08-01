# Desktop push notifications (Web Push)

Reviewers/admins can turn on **desktop notifications** so a pop-up appears on
their computer when there's activity on a deal — even when the portal tab is in
the background or the browser is closed (as long as the browser is running in
the background per the OS). Emails still send as before; this is in addition.

## What triggers a notification (to reviewers/admins)

- **New deal submitted** — a dealer submits a new application.
- **Funding package submitted** — a dealer submits the funding package.
- **New document uploaded** — a dealer uploads a document on a deal.
- **New note from a dealer** — a dealer posts a note.

Notifications carry only a low-sensitivity label (first name + last initial) and
a link into the portal — no full names or personal data.

## How a user turns it on

**My account → Desktop notifications → “Enable desktop notifications.”** The
browser asks for permission once; after that, pop-ups arrive automatically. It's
per-browser/per-computer, so each device where they want pop-ups enables it once.
A **“Send a test”** button confirms it's working.

## Setup (one time, on the server)

Web Push needs a **VAPID keypair**. Generate one:

```
npx web-push generate-vapid-keys
```

Set these in Render → web service → **Environment** (the public key goes in
**both** vars — the browser needs the `NEXT_PUBLIC_` one):

```
VAPID_PUBLIC_KEY          = <public key>
NEXT_PUBLIC_VAPID_PUBLIC_KEY = <public key>   (same value)
VAPID_PRIVATE_KEY         = <private key>      (secret)
VAPID_SUBJECT             = mailto:portal@ghsbarrie.ca
```

Also make sure `APP_URL = https://portal.ghsbarrie.ca` is set (used for the
click-through link).

> `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is read at **build time**, so after setting it,
> trigger a redeploy so the value is baked into the client bundle.

If the keys are not set, the feature stays dormant: the button shows
“not configured,” and nothing else in the portal is affected.

## How it works (for reference)

- `src/lib/push.ts` — sends via the `web-push` library; prunes dead
  subscriptions (HTTP 404/410) automatically.
- `public/sw.js` — the service worker that shows the notification and handles
  clicks (focuses an open portal tab or opens the deal).
- `src/app/api/push/{subscribe,unsubscribe,test}` — store/remove a browser's
  subscription and send a self-test.
- Subscriptions are stored in the `PushSubscription` table (endpoint + keys,
  linked to the user).
- Events are wired through `src/lib/notify.ts` alongside the existing emails.

## Upgrading / rotating keys

If you rotate the VAPID keys, existing browser subscriptions become invalid and
users must click “Enable desktop notifications” again. The server prunes the old
subscriptions on the next failed send.
