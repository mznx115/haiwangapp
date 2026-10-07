import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      // 有新版本时自动接管，用户下次打开就是最新版
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '海王 · AI 社交聊天助手',
        short_name: '海王',
        description: '多对象档案隔离、分寸感话术、一键复制。所有数据只存在这台设备上。',
        lang: 'zh-CN',
        theme_color: '#07c160',
        background_color: '#ededed',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 只预缓存应用外壳。AI 接口请求一律直连，绝不进缓存 —— 否则会拿到过期话术。
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // 明确不缓存跨域 API 请求
        runtimeCaching: [],
      },
      devOptions: {
        // 开发时不开 Service Worker，避免缓存干扰调试
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  // 相对路径产物：既能挂在域名根目录，也能挂在 /haiwangapp/ 这种子路径下
  // （GitHub Pages / 任意静态托管都需要）。配合 hash 路由，刷新不会 404。
  base: './',
  build: {
    // Capacitor 8 内置 WebView 为现代 Chromium，es2020 足够且体积更优
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
