import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      includeAssets: ['favicon.png', 'favicon.svg', 'apple-touch-icon.png', 'icons.svg'],
      manifest: {
        name: 'Vanguard',
        short_name: 'Vanguard',
        description: 'Elite performance, discipline and identity tracking system',
        theme_color: '#000000',
        background_color: '#000000',
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
    }
  }
})
