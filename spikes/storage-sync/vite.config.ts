import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Isolation is required for SharedArrayBuffer / WASM workers (Task 2 finding).
// Set SPIKE_ISOLATE=0 to disable (comparison runs only).
const isolate = process.env.SPIKE_ISOLATE !== '0'
const isolationHeaders = isolate
  ? {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  : undefined

export default defineConfig({
  server: {
    port: 5199,
    strictPort: true,
    headers: isolationHeaders,
  },
  preview: {
    port: 5199,
    strictPort: true,
    headers: isolationHeaders,
  },
  optimizeDeps: {
    exclude: ['@tursodatabase/sync-wasm'],
  },
  worker: {
    format: 'es',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Kaban spike',
        short_name: 'Spike',
        display: 'standalone',
        start_url: '/',
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,svg}'],
        maximumFileSizeToCacheInBytes: 20_971_520,
      },
    }),
  ],
})
