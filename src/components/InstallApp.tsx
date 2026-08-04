'use client';

import { useEffect, useState } from 'react';

// Chrome/Edge/Android fire this before showing their install prompt; we capture
// it so we can trigger install from our own button. iOS Safari does NOT fire it,
// so there we show manual "Add to Home Screen" steps instead.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Platform = 'ios' | 'android' | 'desktop';

export function InstallApp() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari exposes this on navigator when launched from the home screen.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS =
      /iphone|ipad|ipod/.test(ua) ||
      // iPadOS reports as desktop Safari but has touch points.
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    setPlatform(isIOS ? 'ios' : /android/.test(ua) ? 'android' : 'desktop');

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-gray-900">Install the app on your phone</h2>
      <p className="mb-4 text-sm text-gray-500">
        Add GWA Portal to your home screen so it opens like a regular app — full screen, its own icon,
        and ready for push notifications. No app store needed.
      </p>

      {installed ? (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          ✓ The app is installed on this device. You can open it from your home screen.
        </p>
      ) : deferred ? (
        // Android / desktop Chrome / Edge — one-tap install.
        <button type="button" onClick={install} className="btn-primary">
          Install app
        </button>
      ) : platform === 'ios' ? (
        <ol className="space-y-2 text-sm text-gray-700">
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">1</span>
            Open this page in <strong>Safari</strong> (not Chrome or in-app browsers).
          </li>
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">2</span>
            Tap the <strong>Share</strong> button <span aria-hidden>（the square with an ↑）</span> at the bottom.
          </li>
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">3</span>
            Scroll down and tap <strong>&ldquo;Add to Home Screen,&rdquo;</strong> then <strong>Add</strong>.
          </li>
        </ol>
      ) : platform === 'android' ? (
        <ol className="space-y-2 text-sm text-gray-700">
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">1</span>
            Open this page in <strong>Chrome</strong>.
          </li>
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">2</span>
            Tap the <strong>⋮</strong> menu (top-right).
          </li>
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">3</span>
            Tap <strong>&ldquo;Install app&rdquo;</strong> (or &ldquo;Add to Home screen&rdquo;).
          </li>
        </ol>
      ) : (
        <p className="text-sm text-gray-700">
          In Chrome or Edge, click the <strong>install icon</strong> in the address bar (a small screen with a
          down-arrow), or open the browser menu and choose <strong>&ldquo;Install GWA Portal.&rdquo;</strong>
        </p>
      )}
    </div>
  );
}
