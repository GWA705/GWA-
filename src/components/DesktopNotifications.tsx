'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/i18n/client';

/**
 * Enable/disable browser desktop (push) notifications for the current user.
 * Registers the service worker, requests permission, and stores the push
 * subscription on the server. Works even when the portal tab is in the
 * background or the browser is closed (as long as the browser is installed and
 * running in the background per the OS).
 */

// The VAPID public key is fetched at runtime from /api/push/key (not read from a
// build-time NEXT_PUBLIC_* env var), so it takes effect the moment the key is set
// in the server environment and can't vanish on a later image rebuild.
async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/key');
    if (!res.ok) return null;
    const data = (await res.json()) as { key?: string | null };
    return data.key || null;
  } catch {
    return null;
  }
}

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
  const t = useT();
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  // iPhone/iPad only allow push once the site is added to the Home Screen and
  // opened from there (iOS 16.4+). Detect that case so we can guide the user.
  const isIOS =
    typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  const iosNeedsInstall = isIOS && !isStandalone && !supported;

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
      .then((sub) => {
        if (!sub) {
          setStatus('off');
          return;
        }
        setStatus('on');
        // Re-sync this browser's subscription to the server so the database
        // always has it. Self-heals the case where the saved subscription was
        // lost (e.g. a database migration/restore) while the browser still
        // holds one — otherwise the UI shows "on" but test/real pushes go
        // nowhere. The subscribe route upserts by endpoint, so repeating is safe.
        fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
        }).catch(() => {});
      })
      .catch(() => setStatus('off'));
  }, [supported]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const publicKey = await fetchPublicKey();
      if (!publicKey) {
        setMsg(t('desktopNotifications.notConfigured'));
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
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      });
      if (!res.ok) throw new Error('save failed');
      setStatus('on');
      setMsg(t('desktopNotifications.enabledMsg'));
    } catch (e) {
      setMsg(t('desktopNotifications.enableError'));
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
      setMsg(t('desktopNotifications.disabledMsg'));
    } catch (e) {
      setMsg(t('desktopNotifications.disableError'));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      setMsg(res.ok ? t('desktopNotifications.testSent') : t('desktopNotifications.testError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-medium text-gray-700">{t('desktopNotifications.heading')}</h3>
        <p className="text-xs text-gray-500">{t('desktopNotifications.description')}</p>
      </div>

      {status === 'loading' && (
        <p className="text-xs text-gray-400">{t('desktopNotifications.checking')}</p>
      )}

      {iosNeedsInstall ? (
        <p className="text-xs text-amber-700">
          {t('desktopNotifications.iosTapShare')}
          <span className="font-medium">{t('desktopNotifications.shareButton')}</span>
          {t('desktopNotifications.iosThenAdd')}
          <span className="font-medium">{t('desktopNotifications.addToHomeScreen')}</span>
          {t('desktopNotifications.iosOpenPortal')}
        </p>
      ) : (
        status === 'unsupported' && (
          <p className="text-xs text-amber-700">{t('desktopNotifications.unsupported')}</p>
        )
      )}

      {status === 'denied' && (
        <p className="text-xs text-amber-700">{t('desktopNotifications.blocked')}</p>
      )}

      {status === 'off' && (
        <button type="button" className="btn-primary text-sm" onClick={enable} disabled={busy}>
          {busy ? t('desktopNotifications.enabling') : t('desktopNotifications.enable')}
        </button>
      )}

      {status === 'on' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-green-100 text-green-800">
            {t('desktopNotifications.onForBrowser')}
          </span>
          <button type="button" className="btn-secondary text-xs" onClick={sendTest} disabled={busy}>
            {t('desktopNotifications.sendTest')}
          </button>
          <button type="button" className="btn-secondary text-xs" onClick={disable} disabled={busy}>
            {t('desktopNotifications.turnOff')}
          </button>
        </div>
      )}

      {msg && <p className="text-xs text-gray-500">{msg}</p>}
      <p className="text-[11px] text-gray-400">{t('desktopNotifications.footer')}</p>
    </div>
  );
}
