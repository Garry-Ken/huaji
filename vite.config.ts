import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // 相对路径：让打包产物能在 Electron(file://)/Capacitor 本地加载，
  // 同时在网站根目录 '/' 也正常工作。
  base: './',
  plugins: [react()],
})
