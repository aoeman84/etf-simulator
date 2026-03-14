/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  sw: 'sw.js',           // use our custom service worker
  disable: process.env.NODE_ENV === 'development',  // disable in dev to avoid confusion
  runtimeCaching: [
    {
      // Cache ETF price API for 5 minutes
      urlPattern: /^https?.*\/api\/etf-price/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'etf-price-cache',
        expiration: { maxEntries: 20, maxAgeSeconds: 300 },
      },
    },
    {
      // Cache static assets long-term
      urlPattern: /\.(?:js|css|woff2|png|jpg|svg)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
})

const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
}

module.exports = withPWA(nextConfig)
