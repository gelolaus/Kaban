import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    headers: isolationHeaders,
  },
  preview: {
    port: 4173,
    strictPort: true,
    headers: isolationHeaders,
  },
  test: {
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
})
