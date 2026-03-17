import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import base44VitePlugin from '@base44/vite-plugin'
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
  server: {
    allowedHosts: [
      'ta-01kky95yt0rj7mbdr41vd8t57z-5173-ezenw531v4b13gho4kzfmbcri.w.modal.host',
      'ta-01kkykyhprtr346yg27bn4h3sj-5173-m7e3um4hj34gbilddhivagtyh.w.modal.host',
    ],
  },
})