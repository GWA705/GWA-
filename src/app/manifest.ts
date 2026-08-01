import type { MetadataRoute } from 'next';

// Web app manifest — makes the portal installable ("Add to Home Screen"), which
// is what lets iPhones (iOS 16.4+) receive push/desktop notifications. Android
// gets push in the browser without installing, but the manifest gives it a
// proper icon and standalone window too.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GWA Dealer Portal',
    short_name: 'GWA Portal',
    description: 'Secure credit application and funding portal.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1d4ed8',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
