/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Native / heavy modules — external so they aren't bundled (sharp is native;
  // unpdf/tesseract.js/@napi-rs/canvas carry WASM/prebuilt binaries for OCR).
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'unpdf', 'tesseract.js', '@napi-rs/canvas', 'pdf-to-img', 'pdfjs-dist'],
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
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
