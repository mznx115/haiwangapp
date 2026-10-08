import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor } from '@capacitor/core'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App).use(createPinia()).use(router).mount('#app')

/**
 * 只在浏览器里注册 PWA 的 Service Worker（App 内直接跳过）。
 *
 * 为什么 App 内要跳过：打包后所有资源本来就在本地包里，Service Worker
 * 一点收益都没有，反而有风险 —— 覆盖安装新版本时，旧 SW 还活在
 * https://localhost 作用域里，会继续用缓存中的旧 index.html / 旧资源应答。
 * 轻则「更新了还是老界面」，重则旧 HTML 引用到的旧 CSS 已被
 * cleanupOutdatedCaches 清掉，直接 404 变成白板。
 *
 * 这里手写注册而不是用 vite-plugin-pwa 的 virtual:pwa-register，
 * 是为了不引入 workbox-window 依赖（那会把体积带进 APK）。
 * 离线能力和「新版本自动接管」都由构建时生成的 sw.js 提供
 * （registerType: 'autoUpdate' 会写进 skipWaiting + clientsClaim），
 * 与注册方式无关。vite.config.ts 里已关掉自动注入。
 */
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err: unknown) => {
      console.warn('[haiwang] Service Worker 注册失败，离线能力不可用：', err)
    })
  })
}
