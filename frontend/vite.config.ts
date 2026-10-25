import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend address; override with BACKEND_PORT to run a second copy (e.g. for tests).
const backendPort = process.env.BACKEND_PORT || '8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true
      },
      '/ws': {
        target: `ws://127.0.0.1:${backendPort}`,
        ws: true
      }
    }
  }
})
