import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api-9router': {
        target: 'https://9router.riztama.my.id',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-9router/, ''),
      },
    },
  },
})
