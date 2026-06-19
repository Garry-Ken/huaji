# 出安装包（Mac / Windows / 安卓）——手把手

原生安装包只能在 GitHub 云端构建。下面全程用 **GitHub Desktop**（图形界面，不用敲命令）。

## 一次性准备

1. 注册 GitHub 账号：https://github.com/signup
2. 下载安装 **GitHub Desktop**：https://desktop.github.com/
3. 打开 GitHub Desktop → 用你的 GitHub 账号登录

## 第一步：把代码推到 GitHub

1. GitHub Desktop → 菜单 `File → Add Local Repository…`
2. 选择文件夹：`/Users/garry/Developer/labs/expense-tracker`
3. 它会提示"这个文件夹还不是 Git 仓库,要不要创建" → 点 **Create a repository** → Create
4. 点右上角 **Publish repository**
   - 名字填 `huaji`（或你喜欢的）
   - **取消勾选 "Keep this code private"**（公开仓库 Releases 下载链接才好用）
   - 点 Publish
5. 发布完成后,你的仓库地址就是 `github.com/你的用户名/huaji`

> `.gitignore` 已配好,`node_modules`、`dist` 这些不会被传上去,放心。

## 第二步：填一个地方（让下载页指向你的仓库）

1. 用任意编辑器打开 `public/download.html`
2. 找到这一行：`const GH = 'YOUR_GH_USER/YOUR_REPO';`
3. 改成你的：比如 `const GH = '你的用户名/huaji';`
4. 保存 → 回 GitHub Desktop → 填一句说明 → **Commit** → **Push origin**

## 第三步：让 GitHub 云端出安装包

1. 浏览器打开你的仓库 `github.com/你的用户名/huaji`
2. 顶部点 **Actions** 标签
3. 左侧选 **出安装包** → 右侧 **Run workflow** → 版本填 `v0.1.0` → 绿色 **Run workflow**
4. 等 5–15 分钟（Mac/Windows/安卓三台机器同时在云端帮你编译）
5. 跑完后,去仓库的 **Releases** 页,就能看到三个安装包：
   - `huaji-mac.dmg`、`huaji-win.exe`、`huaji-android.apk`
6. 你的下载页 `你的网址/download.html` 的按钮会自动指向它们

## 之后更新

改完代码 → GitHub Desktop 里 Commit + Push → Actions 里再 Run workflow（版本号换成 `v0.1.1` 之类）即可。

## 说明 / 注意

- **第一次跑 Actions 大概率会有红叉**（工具链版本、签名等小问题很常见）。把红色那步的报错截图发我,我帮你改。
- **没签名**：用户安装时 Mac 会提示"无法验证开发者"(右键→打开)、Windows 会有 SmartScreen("仍要运行")、安卓装的是 debug 版(允许未知来源即可)。要消除警告需要付费签名证书,后面再说。
- **iOS** 不在这套里——苹果不允许直链安装,要走 TestFlight / App Store(需 Apple 开发者账号 $99/年)。
- **国内访问**:Netlify 在国内不稳,安装包建议直接用微信 / 网盘(蓝奏云等)把 Releases 链接或文件发给用户。
