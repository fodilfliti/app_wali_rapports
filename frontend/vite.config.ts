import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

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
  server: {
    port: 5174,
    proxy: {
      '/auth': backend,
      '/admin': spaAwareProxy(),
      '/office': spaAwareProxy(),
      '/wali': spaAwareProxy(),
      '/files': backend,
      '/health': backend,
    },
  },
})
