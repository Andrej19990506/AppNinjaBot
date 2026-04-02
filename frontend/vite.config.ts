import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Регистрируем SW из приложения, чтобы показывать кнопку "Обновить"
      injectRegister: null,
      registerType: 'prompt',
      includeAssets: ['Logo.png', 'favicon.ico'],
      manifest: {
        name: 'FloWix - Умная автоматизация для вашего бизнеса',
        short_name: 'FloWix',
        description: 'Инвентаризация, списание, поставки, автоматические отчеты - всё в одной системе. Для магазинов, складов, ресторанов, любых точек продаж. Интеграция с Telegram для мгновенных уведомлений.',
        theme_color: '#0D0D0D',
        background_color: '#0D0D0D',
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
          },
          {
            src: '/Logo.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/Logo.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/Logo.png',
            sizes: '120x120',
            type: 'image/png',
            purpose: 'any'
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        globIgnores: ['**/node_modules/**/*'],
        runtimeCaching: [
          // Telegram Login Widget callback MUST bypass Workbox cache.
          // Otherwise redirects can fail with Workbox "no-response".
          {
            urlPattern: ({ url }) =>
              url.pathname === '/v1/auth/telegram/login' ||
              url.pathname.startsWith('/v1/auth/telegram/login/'),
            handler: 'NetworkOnly',
            options: {
              cacheName: 'auth-bypass'
            }
          },
          {
            urlPattern: /^https?:\/\/.*\.js$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'js-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 день
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Не кэшируем через runtimeCaching весь selcdn.net, иначе могут "залипать"
            // index.html и JS-бандлы на недели (особенно в связке с PWA).
            // Кэшируем только медиа/изображения.
            urlPattern: /^https:\/\/.*\.selcdn\.net\/.*\.(?:png|jpe?g|gif|webp|svg|ico|mp3|mp4|wav|ogg)$/i,
            handler: 'CacheFirst',
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