import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@vanguard/domain': path.resolve(__dirname, './packages/domain/src/index.ts')
    }
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      includeAssets: ['favicon.png', 'favicon.svg', 'apple-touch-icon.png', 'icons.svg'],
      manifest: {
        name: 'Vanguard',
        short_name: 'Vanguard',
        description: 'Elite performance, discipline and identity tracking system',
        // Must match .dark --background in src/index.css — manifest.json/build config
        // can't read CSS custom properties, so this is kept in sync by hand.
        theme_color: '#030712',
        background_color: '#030712',
        start_url: '/',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Dodaj notatkę',
            short_name: 'Notatka',
            description: 'Utwórz nową notatkę w Keep',
            url: '/keep?new=1',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Dodaj zadanie',
            short_name: 'Zadanie',
            description: 'Dodaj nowe zadanie do listy To Do',
            url: '/?todo=new',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Dodaj posiłek',
            short_name: 'Posiłek',
            description: 'Zaloguj posiłek',
            url: '/?meal=new',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Rozpocznij trening',
            short_name: 'Trening',
            description: 'Otwórz logger treningu',
            url: '/trening',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }]
          }
        ],
        share_target: {
          action: '/',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: {
            title: 'share_title',
            text: 'share_text',
            url: 'share_url'
          }
        }
      }
    })
  ],
  server: {
    proxy: {
      '/oura-api': {
        target: 'https://api.ouraring.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oura-api/, ''),
        secure: false
      }
    },
    // Pre-transform the heavy lazy-loaded routes on server start so the first
    // click into them doesn't pay a cold multi-file dev-server waterfall.
    warmup: {
      clientFiles: [
        './src/components/projects/Projects.tsx',
        './src/components/core/DashboardHistoriaTab.tsx',
        './src/components/core/DashboardTydzienTab.tsx',
        './src/components/calendar/CalendarView.tsx',
        './src/components/todo/Todo.tsx',
      ]
    }
  },
  build: {
    sourcemap: true
  }
})
