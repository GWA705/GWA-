'use client';

import { useEffect, useState } from 'react';

/**
 * Enable/disable browser desktop (push) notifications for the current user.
 * Registers the service worker, requests permission, and stores the push
 * subscription on the server. Works even when the portal tab is in the
 * background or the browser is closed (as long as the browser is installed and
 * running in the background per the OS).
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = 'loading' | 'unsupported' | 'off' | 'on' | 'denied';

export function DesktopNotifications() {
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  useEffect(() => {
    if (!supported) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? 'on' : 'off'))
      .catch(() => setStatus('off'));
  }, [supported]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      if (!PUBLIC_KEY) {
        setMsg('Notifications are not configured on the server yet.');
        setBusy(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY) as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      });
      if (!res.ok) throw new Error('save failed');
      setStatus('on');
      setMsg('Desktop notifications are on for this browser.');
    } catch (e) {
      setMsg('Could not turn on notifications. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('off');
      setMsg('Desktop notifications are off for this browser.');
    } catch (e) {
      setMsg('Could not turn off notifications.');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      setMsg(res.ok ? 'Test notification sent.' : 'Could not send a test notification.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-medium text-gray-700">Desktop notifications</h3>
        <p className="text-xs text-gray-500">
          Get a pop-up on your computer when there’s activity on a deal — new submissions, uploads,
          funding packages, and notes — even when the portal isn’t the active tab.
        </p>
      </div>

      {status === 'loading' && <p className="text-xs text-gray-400">Checking…</p>}

      {status === 'unsupported' && (
        <p className="text-xs text-amber-700">
          This browser doesn’t support desktop notifications. Try Chrome, Edge, or Firefox on a
          computer.
        </p>
      )}

      {status === 'denied' && (
        <p className="text-xs text-amber-700">
          Notifications are blocked for this site in your browser settings. Allow notifications for
          this site, then reload and try again.
        </p>
      )}

      {status === 'off' && (
        <button type="button" className="btn-primary text-sm" onClick={enable} disabled={busy}>
          {busy ? 'Enabling…' : 'Enable desktop notifications'}
        </button>
      )}

      {status === 'on' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-green-100 text-green-800">On for this browser</span>
          <button type="button" className="btn-secondary text-xs" onClick={sendTest} disabled={busy}>
            Send a test
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={disable} disabled={busy}>
            Turn off
          </button>
        </div>
      )}

      {msg && <p className="text-xs text-gray-500">{msg}</p>}
      <p className="text-[11px] text-gray-400">
        Turn this on for each computer/browser where you want pop-ups. Emails still send regardless.
      </p>
    </div>
  );
}
