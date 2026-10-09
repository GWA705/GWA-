import 'server-only';

/**
 * Zoom cloud-recordings integration (read-only).
 *
 * Uses a Zoom **Server-to-Server OAuth** app. Set these on the environment (no
 * code change needed); until they're all present the feature is dormant:
 *
 *   ZOOM_ACCOUNT_ID       - the Zoom account ID (Server-to-Server OAuth app)
 *   ZOOM_CLIENT_ID        - the app's Client ID
 *   ZOOM_CLIENT_SECRET    - the app's Client Secret
 *   ZOOM_RECORDINGS_USER  - whose recordings to pull (email or user id);
 *                           defaults to "me" (the account owner)
 *
 * Scope required on the app: recording:read:admin (and user:read:admin if you set
 * ZOOM_RECORDINGS_USER to a specific user).
 */

export function zoomConfigured(): boolean {
  return !!(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
}

function recordingsUser(): string {
  return (process.env.ZOOM_RECORDINGS_USER || 'me').trim();
}

// Cache the access token for its lifetime (Zoom tokens last ~1 hour).
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (!zoomConfigured()) return null;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const accountId = process.env.ZOOM_ACCOUNT_ID!;
  const basic = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64');
  try {
    const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!res.ok) {
      console.error('[zoom] token failed', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return tokenCache.token;
  } catch (e) {
    console.error('[zoom] token error', e);
    return null;
  }
}

export interface ZoomRecordingSummary {
  uuid: string;
  meetingId: string | null;
  topic: string;
  startTime: Date;
  durationMin: number;
  shareUrl: string;
  passcode: string | null;
  fileCount: number;
  totalSize: number;
}

// Shape of the bits of a Zoom "meeting recording" object we use.
interface ZoomMeetingRaw {
  uuid?: string;
  id?: number | string;
  topic?: string;
  start_time?: string;
  duration?: number;
  share_url?: string;
  recording_play_passcode?: string;
  password?: string;
  total_size?: number;
  recording_count?: number;
  recording_files?: { file_type?: string }[];
}

function mapMeeting(m: ZoomMeetingRaw): ZoomRecordingSummary | null {
  if (!m.uuid || !m.start_time) return null;
  const files = Array.isArray(m.recording_files) ? m.recording_files : [];
  return {
    uuid: m.uuid,
    meetingId: m.id != null ? String(m.id) : null,
    topic: (m.topic || 'Zoom recording').trim(),
    startTime: new Date(m.start_time),
    durationMin: Math.max(0, Math.round(Number(m.duration) || 0)),
    shareUrl: m.share_url || '',
    passcode: m.recording_play_passcode || m.password || null,
    fileCount: m.recording_count ?? files.length,
    totalSize: Math.max(0, Math.round(Number(m.total_size) || 0)),
  };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * List cloud recordings between two dates (inclusive). Zoom caps each query to a
 * one-month window, so callers pass a <=30-day range. Paginates. Returns only
 * meetings that actually have a share URL.
 */
export async function listCloudRecordings(from: Date, to: Date): Promise<ZoomRecordingSummary[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const user = encodeURIComponent(recordingsUser());
  const out: ZoomRecordingSummary[] = [];
  let nextPageToken = '';
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`https://api.zoom.us/v2/users/${user}/recordings`);
    url.searchParams.set('from', ymd(from));
    url.searchParams.set('to', ymd(to));
    url.searchParams.set('page_size', '300');
    if (nextPageToken) url.searchParams.set('next_page_token', nextPageToken);

    try {
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        console.error('[zoom] recordings failed', res.status, (await res.text().catch(() => '')).slice(0, 200));
        break;
      }
      const json = (await res.json()) as { meetings?: ZoomMeetingRaw[]; next_page_token?: string };
      for (const m of json.meetings ?? []) {
        const mapped = mapMeeting(m);
        if (mapped && mapped.shareUrl) out.push(mapped);
      }
      nextPageToken = json.next_page_token || '';
      if (!nextPageToken) break;
    } catch (e) {
      console.error('[zoom] recordings error', e);
      break;
    }
  }
  return out;
}

export function formatBytes(n: number): string {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(0)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
