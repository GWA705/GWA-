import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StagingBanner } from '@/components/StagingBanner';
import { VersionWatcher } from '@/components/VersionWatcher';
import { getBuildId } from '@/lib/version';

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
  appleWebApp: { capable: true, title: 'GWA Portal', statusBarStyle: 'default' },
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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Elegant script face for the dashboard hero flourish ("Better Water /
            Brighter Lives"). Loaded at runtime; degrades to cursive if blocked. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet" />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <VersionWatcher currentBuildId={getBuildId()} />
        <StagingBanner />
        {children}
      </body>
    </html>
  );
}
