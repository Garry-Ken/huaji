import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor：把打包好的网页 (dist) 装进一个安卓 WebView，生成 .apk。
const config: CapacitorConfig = {
  appId: 'app.huaji.tracker',
  appName: '花迹',
  webDir: 'dist',
}

export default config
