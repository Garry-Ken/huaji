# 花迹 管理员设置指南

## 一、Supabase 邮件模板（必做）

1. 打开 Supabase 控制台 → **Authentication** → **Email Templates**
2. 找到 **Magic Link / OTP** 模板
3. 把模板内容改为：

```html
<h2>花迹验证码</h2>
<p>您的验证码是：<strong>{{ .Token }}</strong></p>
<p>5 分钟内有效，请勿泄露给他人。</p>
```

4. 点 **Save**

## 二、设置自己为管理员

1. 在花迹 App 里用你的邮箱登录一次（我的 → 登录）
2. 打开 Supabase 控制台 → **Authentication** → **Users**
3. 找到你的账号，复制 `UID`（类似 `a1b2c3d4-...`）
4. 去 **SQL Editor** → **New query**，运行：

```sql
INSERT INTO public.admins(user_id) VALUES ('你的UID') ON CONFLICT DO NOTHING;
```

5. 回到 App，刷新「我的」页面，底部会出现 **🛠️ 店主面板**

## 三、云端同步表（可选，Pro 功能）

如果要启用云端同步，在 SQL Editor 运行 `supabase/schema.sql` 中 **Phase 2** 部分的建表语句。

## 四、管理员日常操作

### 发兑换码
店主面板 → 点「月度码/季度码/年度码」→ 生成后复制发给买家

### 直接开通
店主面板 → 输入买家邮箱 → 点「开月度/开季度/开年度」（买家需先登录过一次）

### 买家付款流程
1. 买家在 App 看到升级页面，扫码付款
2. 买家把付款截图发给你（微信/邮箱）
3. 你在店主面板生成码或直接按邮箱开通
4. 买家输入兑换码或重新登录即可

## 五、待完成项

- [ ] 在 Supabase 改邮件模板（加 `{{ .Token }}`）
- [ ] 用你的邮箱在 App 里登录
- [ ] 在 SQL Editor 把自己设为管理员
- [ ] 配置自定义 SMTP（Supabase 默认每小时限 3 封，正式上线前需换）
- [ ] 把收款码图片放到 `public/pay/` 下（如未放）
