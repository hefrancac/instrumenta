import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The app talks to the backend at whatever URL you type in the in-app
// "conectar a um backend real" panel (default flow). The backend already
// allows http://localhost:5173 via CORS, so no proxy is needed.
export default defineConfig({
  plugins: [
    react(),
    // PWA: app instalável + offline-first (útil no 4G ruim da clínica).
    // Em modo demo o app é 100% client-side, então funciona offline após a 1ª visita.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'logo-mark.svg'],
      manifest: {
        name: 'Instrumenta',
        short_name: 'Instrumenta',
        description: 'Compare preços de material odontológico entre as dentais, já contando o frete.',
        lang: 'pt-BR',
        theme_color: '#0B6E5F',
        background_color: '#F1F5F4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Fontes do Google (cross-origin) — cacheia em runtime para funcionar offline.
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
  // Vitest roda os *.test.js unitários; os *.spec.js do Playwright (e2e/) ficam de fora.
  test: { exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"] },
})
