import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// Content hash of the dataset, appended to its URL so a new deploy's word data is
// fetched instead of being served from the long-lived runtime cache.
const vocabularyVersion = createHash('sha256')
  .update(readFileSync(new URL('./public/data/vocabulary.json', import.meta.url)))
  .digest('hex')
  .slice(0, 12)

// https://vite.dev/config/
export default defineConfig({
  define: {
    __VOCABULARY_VERSION__: JSON.stringify(vocabularyVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Oxford Söz Ehtiyatı',
        short_name: 'OxfordSöz',
        description: 'Oxford 5000 söz siyahısı ilə ingilis dili lüğətini öyrənmək üçün tətbiq',
        theme_color: '#2f6f4f',
        background_color: '#f7f6f2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        globIgnores: ['data/**'],
        navigateFallback: '/index.html',
        // Removes stale precache entries from prior SW versions on activation.
        // This only touches the Cache Storage API (app-shell assets) — it never
        // touches IndexedDB or localStorage, so learning progress is unaffected.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: { cacheName: 'app-shell' },
          },
          {
            // word illustrations: cached as each one is first shown, then available offline
            urlPattern: ({ url }) => url.pathname.includes('/images/words/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'word-images',
              expiration: { maxEntries: 6000, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // the 5000-word vocabulary dataset: cache on first load, then serve
            // instantly offline without re-downloading on every visit.
            urlPattern: ({ url }) => url.pathname.endsWith('/data/vocabulary.json'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'vocabulary-data',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
