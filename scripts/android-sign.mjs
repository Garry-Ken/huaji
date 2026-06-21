// 给 Capacitor 生成的 android/app/build.gradle 注入 release 签名配置。
// 因为 CI 每次 `npx cap add android` 都会重建 android/，所以在 sync 后运行本脚本。
// 签名材料从环境变量读取（CI 里由 GitHub Secrets 提供），密钥库本身不入库。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const path = 'android/app/build.gradle'
if (!existsSync(path)) {
  console.error('找不到', path, '（请先 npx cap add android）')
  process.exit(1)
}
let g = readFileSync(path, 'utf8')

// 按 package.json 版本号写入 versionCode / versionName，保证更新时版本号递增
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const [maj = 0, min = 0, pat = 0] = String(pkg.version).split('.').map((n) => parseInt(n, 10) || 0)
  const code = maj * 10000 + min * 100 + pat
  g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`)
  g = g.replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`)
  console.log(`✓ versionCode=${code} versionName=${pkg.version}`)
} catch { /* ignore */ }

if (g.includes('signingConfigs')) {
  console.log('build.gradle 已含签名配置，跳过签名注入')
  writeFileSync(path, g)
  process.exit(0)
}

const signingBlock = `
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH"))
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
            storeType "PKCS12"
        }
    }`

// 1) 在 android { 之后插入 signingConfigs
g = g.replace(/android\s*\{/, (m) => m + signingBlock)
// 2) 在 buildTypes 的 release { 内挂上 signingConfig
g = g.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{)/, (m) => m + '\n            signingConfig signingConfigs.release')

writeFileSync(path, g)
console.log('✓ 已为 release 注入固定签名配置')
