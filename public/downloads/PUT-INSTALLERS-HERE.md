# 安装包放这里

把构建好的安装包按这些文件名放进本目录，`/download.html` 会自动指向它们：

| 平台 | 文件名 | 怎么构建 |
|---|---|---|
| 安卓 | `huaji-0.1.0.apk` | Capacitor + Android Studio：`npm run build && npx cap sync android` → Android Studio 里 Build APK |
| Mac | `huaji-0.1.0.dmg` | Tauri：`npm run build && npx tauri build`（产物在 `src-tauri/target/release/bundle/dmg/`） |
| Windows | `huaji-0.1.0-setup.exe` | Tauri 在 Windows 上 `npx tauri build`（或用 GitHub Actions 跨平台出包） |

iOS 不放这里——iOS 不能直链安装，走 **TestFlight**（在 `download.html` 里把 `iosTestFlight` 换成你的链接）或 App Store。

> 这些原生安装包需要在你本机用 Xcode / Android Studio / Rust 工具链构建（含签名），我所在的环境没有这些原生 SDK，所以由你出包、丢进这里即可。
