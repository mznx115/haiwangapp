import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { legacyCss } from './build/vite-plugin-legacy-css'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      // 有新版本时自动接管，用户下次打开就是最新版
      registerType: 'autoUpdate',
      // 不在 HTML 里自动注入注册脚本：App 内要跳过 Service Worker，
      // 改由 src/main.ts 判断平台后手动注册。详见该文件注释。
      injectRegister: null,
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
    // 必须放在最后：展平 @layer 并把 CSS 内联进 HTML，
    // 否则老版 Android WebView 会整份丢弃样式。
    legacyCss(),
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
    // 注意：Android 端的 WebView 是**系统**提供的，不是 Capacitor 自带的。
    // 国内不少 ROM 的 System WebView 不随 Google Play 更新，可能停在 Chrome 80~95。
    // 所以不要按"现代 Chromium"来假设能力 —— 详见 build/vite-plugin-legacy-css.ts。
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
})
