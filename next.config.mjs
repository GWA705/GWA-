/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // sharp is a native module — keep it external so it isn't bundled.
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
    // Match the ~15 MB document-upload intent (server actions default to 1 MB).
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  // Security headers are also enforced in middleware.ts; these are a static baseline.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
