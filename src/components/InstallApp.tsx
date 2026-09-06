'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/i18n/client';

// Chrome/Edge/Android fire this before showing their install prompt; we capture
// it so we can trigger install from our own button. iOS Safari does NOT fire it,
// so there we show manual "Add to Home Screen" steps instead.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Platform = 'ios' | 'android' | 'desktop';

export function InstallApp() {
  const t = useT();
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
      <h2 className="mb-1 text-base font-semibold text-gray-900">{t('installApp.title')}</h2>
      <p className="mb-4 text-sm text-gray-500">{t('installApp.description')}</p>

      {installed ? (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          ✓ {t('installApp.installed')}
        </p>
      ) : deferred ? (
        // Android / desktop Chrome / Edge — one-tap install.
        <button type="button" onClick={install} className="btn-primary">
          {t('installApp.installButton')}
        </button>
      ) : platform === 'ios' ? (
        <ol className="space-y-2 text-sm text-gray-700">
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">1</span>
            {t('installApp.ios.step1Pre')}<strong>Safari</strong>{t('installApp.ios.step1Post')}
          </li>
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">2</span>
            {t('installApp.ios.step2Pre')}<strong>{t('installApp.ios.shareLabel')}</strong>{t('installApp.ios.step2Mid')}<span aria-hidden>{t('installApp.ios.shareHint')}</span>{t('installApp.ios.step2Post')}
          </li>
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">3</span>
            {t('installApp.ios.step3Pre')}<strong>{t('installApp.ios.addToHome')}</strong>{t('installApp.ios.step3Mid')}<strong>{t('installApp.ios.addLabel')}</strong>{t('installApp.ios.step3Post')}
          </li>
        </ol>
      ) : platform === 'android' ? (
        <ol className="space-y-2 text-sm text-gray-700">
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">1</span>
            {t('installApp.android.step1Pre')}<strong>Chrome</strong>{t('installApp.android.step1Post')}
          </li>
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">2</span>
            {t('installApp.android.step2Pre')}<strong>⋮</strong>{t('installApp.android.step2Post')}
          </li>
          <li>
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">3</span>
            {t('installApp.android.step3Pre')}<strong>{t('installApp.android.installAppLabel')}</strong>{t('installApp.android.step3Post')}
          </li>
        </ol>
      ) : (
        <p className="text-sm text-gray-700">
          {t('installApp.desktop.pre')}<strong>{t('installApp.desktop.installIcon')}</strong>{t('installApp.desktop.mid')}<strong>{t('installApp.desktop.installBrand')}</strong>
        </p>
      )}
    </div>
  );
}
