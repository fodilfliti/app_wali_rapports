import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backend = 'http://localhost:4001'

/** Dev only: browser reloads (Accept: text/html) must serve the SPA, not proxy to the API. */
function spaAwareProxy(): ProxyOptions {
  return {
    target: backend,
    bypass(req) {
      const accept = req.headers.accept || ''
      if (accept.includes('text/html')) {
        return '/index.html'
      }
    },
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@wali/access-policy': path.resolve(__dirname, '../shared/access-policy/src'),
      '@wali/routes': path.resolve(__dirname, '../shared/routes/src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/auth': backend,
      '/admin': spaAwareProxy(),
      '/office': spaAwareProxy(),
      '/cabinet': spaAwareProxy(),
      '/wali': spaAwareProxy(),
      '/governor': spaAwareProxy(),
      '/chef': spaAwareProxy(),
      '/chief': spaAwareProxy(),
      '/files': backend,
      '/health': backend,
    },
  },
})
