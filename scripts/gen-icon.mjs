// 从 public/icon.svg 生成一张 1024×1024 PNG 给 electron-builder 用（自动转 .icns/.ico）。
// 在 CI 里构建前跑一次，避免往仓库里塞二进制图标。
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

mkdirSync('build', { recursive: true })
await sharp('public/icon.svg', { density: 512 })
  .resize(1024, 1024, { fit: 'contain', background: { r: 10, g: 132, b: 255, alpha: 1 } })
  .png()
  .toFile('build/icon.png')

console.log('✅ build/icon.png 生成完成')
