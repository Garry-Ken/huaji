# 花迹 · 智能记账（Expense Tracker）

一句话记账 → 自动**结构化 / 分类 / 饮食健康分析**，多周期可视化。
一套 React 代码，**网页 + Mac + Windows + 安卓 + 苹果**全平台可用（PWA 优先，可打包为原生应用）。

## ✨ 已实现功能

| 需求 | 实现 |
| --- | --- |
| 文字输入自动结构化、分类 | `src/lib/parser.ts`：金额 / 时间 / 地点 / 商家 / 分类识别 |
| 饮食健康度分析 + 优化建议 | `src/lib/foodDb.ts` + `src/lib/health.ts`：内置食物营养库打分，单餐与周期级建议 |
| 记录原始输入时间 & 地点 | 每条记录同时存 `occurredAt`（消费时间，解析推断）与 `createdAt`（录入时间）+ `location` |
| 语音输入 | `src/lib/speech.ts`：Web Speech API（中文），不支持时自动隐藏 |
| 粘贴 / 编辑 / 修改 | 粘贴按钮 + 点击任意记录打开编辑表单（金额/分类/时间/地点/备注，改完自动重算健康分） |
| 周 / 月 / 季 / 半年 / 年 / 日可视化 | `src/components/Dashboard.tsx`：周期切换 + 环形分类图 + 趋势柱状图 + 分类明细 + 环比 |
| 半年 / 年度健康分析 | `src/components/HealthPanel.tsx`：综合评分、健康分趋势、餐次分布、做得好/待改进、周期建议 |
| 全平台适配 | 响应式布局（手机底部 Tab / 桌面顶部导航）、深浅色、PWA 可安装、安全区适配 |

> 解析与健康分析当前为**本地规则引擎**（离线、零成本、无需 Key）。`parser.ts` / `health.ts` 是清晰的接口层，后续可平滑替换为 Claude API 增强（见下文）。

## 🚀 本地运行

```bash
npm install
npm run dev      # http://localhost:5176（或 5173）
npm run build    # 产物输出到 dist/
npm run preview  # 预览生产构建
```

首次打开会注入约 150 天示例数据，方便查看各周期图表；数据存于浏览器 `localStorage`（本地优先，隐私不出端）。

## 📦 打包到各平台

PWA 本身已可在浏览器「添加到主屏幕 / 安装」，覆盖网页 + 桌面 + 移动浏览器。如需上架应用商店 / 原生壳：

- **iOS / Android 原生壳** → [Capacitor](https://capacitorjs.com/)
  ```bash
  npm i -D @capacitor/cli @capacitor/core
  npx cap init 花迹 com.huaji.app --web-dir=dist
  npm i @capacitor/ios @capacitor/android
  npm run build && npx cap add ios && npx cap add android && npx cap sync
  ```
  之后用 Xcode / Android Studio 打开即可真机调试、上架。语音可换 `@capacitor-community/speech-recognition` 获得原生权限体验。
- **Mac / Windows 桌面应用** → [Tauri](https://tauri.app/)（体积小、性能好）
  ```bash
  npm i -D @tauri-apps/cli && npx tauri init   # frontendDist 指向 dist
  npx tauri build
  ```

## 🤖 升级为 Claude 增强（可选）

要把解析 / 健康建议升级为 LLM，只需在 `parser.ts` 的 `parseExpense` 与 `health.ts` 的 `analyzeMeal` 外加一层：联网且配置了 Key 时调用 Claude（`claude-opus-4-8` 等），失败或离线时回退到现有本地规则。建议把 Key 放在轻量后端代理而非前端，避免泄露。

## 🗂 目录结构

```
src/
  lib/        parser / foodDb / health / date / format / storage / speech / sampleData
  components/ InputBar · RecordsView · Dashboard · HealthPanel · EditSheet · charts · bits · icons
  App.tsx     状态、持久化、导航、深浅色
```

## 💳 商业化 / 订阅（MVP 已内置，纯前端可跑）

权益层在 [entitlement.tsx](expense-tracker/src/lib/entitlement.tsx)，是订阅的「唯一真相」。当前为本地模拟，**不会真实扣款**，但 UI 与门控逻辑已完整，后端接进来不用改界面。

- **7 天免费试用**：首启免费，`startTrial()` 起算；`试用 → 到期回到免费 → 订阅 Pro` 状态机完整。
- **免费 / Pro 分级**：免费可用 日/周/月 + 记账 + 基础健康；Pro 解锁 **季度/半年/年度深度分析、长周期健康趋势、AI 增强、云同步、CSV 导出、无限历史**。
- **付费墙** [Paywall.tsx](expense-tracker/src/components/Paywall.tsx)：国内 ¥20 / ¥48(季,8折) / ¥192(年,8折)；海外 $19.99 / $47.98 / $191.90。年度「最划算」默认。
- **我的页** [AccountView.tsx](expense-tracker/src/components/AccountView.tsx)：订阅状态、权益清单、AI 开关、CSV 导出、恢复购买，以及一组「演示控制」可一键切换试用/订阅/免费状态。

**后端接入缝**（搜代码里的 `⛳️ BACKEND SEAM`）：
- **Phase 1**：`loadEntitlement` → Supabase 权益表；`subscribe` → Stripe Checkout / 微信支付宝；Webhook 回写权益。
- **Phase 2**：`subscribe` / `restore` → RevenueCat 统一 iOS/Android 内购。

成本结构与定价策略（含 Haiku/Sonnet/Opus 每条解析成本、单位经济）见对话记录；策略是 **本地引擎免费兜底 → Haiku 做解析 → Sonnet 跑周期报告，AI 归 Pro**。

## 🛠 技术栈

React 19 · TypeScript · Vite 8 · Tailwind CSS 3 · 纯手写 SVG/CSS 图表（零图表库依赖）· PWA。
