import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GWA Dealer Portal',
  description: 'Secure credit application and funding portal.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
