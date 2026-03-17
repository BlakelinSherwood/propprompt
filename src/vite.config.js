import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { base44VitePlugin } from '@base44/vite-plugin'
import path from 'path'

export default defineConfig({
  plugins: [
    base44VitePlugin(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})