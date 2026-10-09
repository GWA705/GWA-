# Zoom recordings → dealer portal

GWA's Zoom cloud recordings sync into the portal automatically. New recordings
land in a **review queue**; an admin **publishes** the ones that should go live,
and **all dealers** see the published recordings under **Recordings** in the
dealer portal, with a **Watch / Download** link (opens Zoom) and the passcode.

It's **dormant** until Zoom credentials are set. Dealers never see pending or
hidden recordings, and the "Recordings" tab only appears once something is
published.

## Turning it on

1. **Create a Zoom Server-to-Server OAuth app** (Zoom Marketplace → Develop →
   Build App → *Server-to-Server OAuth*). Add scope **`recording:read:admin`**
   (and `user:read:admin` if you'll pull a specific user's recordings). Activate
   the app. Copy the **Account ID, Client ID, Client Secret**.
2. **Set on Elastic Beanstalk** (no code change):
   - `ZOOM_ACCOUNT_ID`
   - `ZOOM_CLIENT_ID`
   - `ZOOM_CLIENT_SECRET`
   - `ZOOM_RECORDINGS_USER` *(optional — the host whose recordings to pull, by
     email or user id; defaults to `me`, the account owner)*
3. **Cron:** add a scheduled call (a few times a day is plenty), like the other
   Render crons:
   `curl -H "Authorization: Bearer $CRON_SECRET" https://portal.ghsbarrie.ca/api/cron/zoom-sync`
4. **Zoom share settings:** make sure the recordings are shareable and
   "Viewers can download" is ON in Zoom, so dealers can watch/download from the
   share link. If a recording has a passcode, the sync captures it when Zoom
   returns it; otherwise paste it in the admin editor.

## Using it

- **Admin → Zoom recordings:** recordings sync in (or hit **Sync now**). For each
  one: **Publish** (goes live to all dealers), **Edit** the dealer-facing title /
  description / passcode, or **Hide**. Unpublish any time.
- **Dealers → Recordings:** published recordings, newest first, each with a
  Watch/Download button (opens Zoom) and the passcode.

## Notes / future options

- **Delivery = link to Zoom** (chosen to start): we store the Zoom share URL +
  passcode; the video stays on Zoom (no storage cost). If Zoom share links ever
  expire or you want the video hosted on the portal itself, the follow-up is to
  **mirror the MP4 into S3** and serve it through the portal (bigger storage +
  bandwidth). Noted in `OPEN-QUESTIONS.md`.
- Access is **all dealers**. Per-recording targeting (specific offices) is a
  possible later add.

## Code

- `src/lib/zoom.ts` — S2S OAuth token (cached) + `listCloudRecordings`.
- `src/lib/zoomSync.ts` — `syncZoomRecordings` (dedupe by UUID, new → PENDING).
- `src/app/api/cron/zoom-sync/route.ts` — cron endpoint (CRON_SECRET).
- Admin: `src/app/(admin)/admin/zoom-recordings/` + actions in `(admin)/actions.ts`.
- Dealer: `src/app/(dealer)/dealer/recordings/page.tsx` (+ nav gated on a
  published count in `(dealer)/layout.tsx`).
- Model: `ZoomRecording` (migration `20261009020000_zoom_recordings`).
