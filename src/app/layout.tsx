import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StagingBanner } from '@/components/StagingBanner';

export const metadata: Metadata = {
  title: 'GWA Dealer Portal',
  description: 'Secure credit application and funding portal.',
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  // Lets iPhones add the portal to the Home Screen as an app, which is required
  // for push notifications on iOS (16.4+).
  appleWebApp: { capable: true, title: 'GWA Portal', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
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
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <StagingBanner />
        {children}
      </body>
    </html>
  );
}
