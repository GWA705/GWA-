import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StagingBanner } from '@/components/StagingBanner';
import { VersionWatcher } from '@/components/VersionWatcher';
import { getBuildId } from '@/lib/version';
import { LocaleProvider } from '@/i18n/client';
import { getLocale } from '@/i18n/server';

const SITE_URL = 'https://portal.ghsbarrie.ca';
const SHARE_TITLE = 'GWA Dealer Portal';
const SHARE_DESC = 'Your hub for managing and growing your business — Georgian Water & Air.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SHARE_TITLE,
  description: SHARE_DESC,
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  // Lets iPhones add the portal to the Home Screen as an app, which is required
  // for push notifications on iOS (16.4+).
  appleWebApp: {
    capable: true,
    title: 'GWA Portal',
    statusBarStyle: 'default',
    // Branded launch screen (blue tile + icon) for installed iOS PWAs, so opening
    // the app shows the brand instead of a white flash — matching Android, which
    // uses the manifest icon + background_color. One image per iPhone resolution
    // (assets generated into /public/splash). Apple requires PNG here.
    startupImage: [
      { url: '/splash/splash-640x1136.png', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
      { url: '/splash/splash-750x1334.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
      { url: '/splash/splash-1242x2208.png', media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/splash-1125x2436.png', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/splash-1080x2340.png', media: '(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/splash-828x1792.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)' },
      { url: '/splash/splash-1242x2688.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/splash-1170x2532.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/splash-1179x2556.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/splash-1284x2778.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
      { url: '/splash/splash-1290x2796.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)' },
    ],
  },
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // What shows when the portal link is shared (iMessage, WhatsApp, email, etc.).
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SHARE_TITLE,
    title: SHARE_TITLE,
    description: SHARE_DESC,
    images: [{ url: '/og-share.png', width: 1200, height: 630, alt: 'GWA Dealer Portal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_DESC,
    images: ['/og-share.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#1d4ed8',
};

// Applies the saved light/dark/system theme before first paint (no flash).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Elegant script face for the dashboard hero flourish ("Better Water /
            Brighter Lives"). Loaded at runtime; degrades to cursive if blocked. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet" />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <LocaleProvider locale={locale}>
          <VersionWatcher currentBuildId={getBuildId()} />
          <StagingBanner />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
