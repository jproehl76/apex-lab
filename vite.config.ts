import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest: use our custom src/sw.ts so we can handle Share Target + Web Push
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      scope: '/apex-lab/',
      base: '/apex-lab/',
      // Use existing public/manifest.json (not auto-generated)
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,woff2}'],
      },
      devOptions: {
        enabled: false, // keep SW off in dev to avoid stale cache headaches
      },
    }),
  ],
  base: '/apex-lab/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          d3: ['d3'],
          geo: ['leaflet', 'react-leaflet'],
        },
      },
    },
  },
})
