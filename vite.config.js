import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const npProxy = {
  '/np-api': {
    target: 'https://api.novaposhta.ua',
    changeOrigin: true,
    rewrite: () => '/v2.0/json/',
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: npProxy },
  preview: { proxy: npProxy },
})
