import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = 'http://localhost:4001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/auth': backend,
      '/admin': backend,
      '/office': backend,
      '/wali': backend,
      '/files': backend,
      '/health': backend,
    },
  },
})
