import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Logo.png', 'favicon.ico'],
      manifest: {
        name: 'FloWix - Умная автоматизация для вашего бизнеса',
        short_name: 'FloWix',
        description: 'Инвентаризация, списание, поставки, автоматические отчеты - всё в одной системе. Для магазинов, складов, ресторанов, любых точек продаж. Интеграция с Telegram для мгновенных уведомлений.',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/Logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/Logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'График курьеров',
            short_name: 'График',
            description: 'Открыть график курьеров',
            url: '/courier-schedule',
            icons: [{ src: '/Logo.png', sizes: '192x192' }]
          },
          {
            name: 'Инвентарь',
            short_name: 'Инвентарь',
            description: 'Открыть инвентарь',
            url: '/inventory',
            icons: [{ src: '/Logo.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.selcdn\.net\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 дней
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/api\.telegram\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'telegram-api-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 // 1 час
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@entities': path.resolve(__dirname, 'src/entities'),
      '@app': path.resolve(__dirname, 'src/app'),
      '@widgets': path.resolve(__dirname, 'src/widgets'),
      '@pages': path.resolve(__dirname, 'src/pages'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    cors: true,
    open: false,
  },
})