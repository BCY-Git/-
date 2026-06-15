import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: process.env.VITE_DEV_HOST || '127.0.0.1',
    port: 8100,
    proxy: {
      '/api': 'http://127.0.0.1:8000'
    }
  },
  preview: {
    host: process.env.VITE_PREVIEW_HOST || '127.0.0.1'
  }
})
