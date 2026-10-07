import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.haiwang.chat',
  appName: '海王',
  webDir: 'dist',
  server: {
    // App 页面 origin 为 https://localhost
    androidScheme: 'https',
  },
  android: {
    // 关键：允许 https 来源的页面请求明文 http 接口
    // （配合 android/app/src/main/res/xml/network_security_config.xml 放行目标 IP）
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
}

export default config
