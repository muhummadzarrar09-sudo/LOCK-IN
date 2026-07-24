import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable Next/Image for automatic optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Aggressive caching for static assets (immutable hashed bundles)
  async headers() {
    return [
      {
        // Hashed Next.js bundles — cache forever
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Public images — long cache
        source: '/icon-:size.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000' }, // 30 days
        ],
      },
      {
        // Sitemap and robots — short cache
        source: '/(sitemap.xml|robots.txt)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' }, // 1 hour
        ],
      },
      {
        // Public pages — short cache + stale-while-revalidate
        source: '/(privacy|terms)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=86400' },
        ],
      },
      {
        // Service worker — never cache (must always be fresh)
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Manifest — short cache (icons may update)
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },

  // React strict mode catches bugs early
  reactStrictMode: true,

  // Compress responses
  compress: true,

  // Production source maps OFF (smaller bundle, harder to reverse-engineer)
  productionBrowserSourceMaps: false,
};

export default nextConfig;
