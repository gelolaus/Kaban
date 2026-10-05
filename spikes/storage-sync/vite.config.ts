import { defineConfig } from 'vite'

const isolate = process.env.SPIKE_ISOLATE === '1'
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
})
