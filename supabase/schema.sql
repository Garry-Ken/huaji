-- ============================================================================
-- 花迹 · Phase-1 付费后端 数据库脚本
--
-- 用法：Supabase 控制台 → SQL Editor → New query → 整段粘贴 → Run。
-- 可重复运行（幂等）。安全模型：客户端只能读“自己的”权益；所有写入都走下面的
-- SECURITY DEFINER 函数（服务端执行、带授权校验），没有任何密钥下发到客户端。
-- ============================================================================

-- 1) 权益表：每个用户一行
create table if not exists public.entitlements (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  plan       text check (plan in ('monthly','quarterly','annual')),
  started_at timestamptz,
  expires_at timestamptz,
  source     text,                       -- redeem | grant
  updated_at timestamptz not null default now()
);

-- 2) 兑换码表：服务端铸造、原子核销，防跨设备重复使用
create table if not exists public.redeem_codes (
  code       text primary key,
  plan       text not null check (plan in ('monthly','quarterly','annual')),
  created_at timestamptz not null default now(),
  used_by    uuid references auth.users(id),
  used_at    timestamptz
);

-- 3) 店主名单：只有这里的 uid 能发码 / 按邮箱开通
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- 1.1) 会员档位（plus/pro/ultra）。向后兼容：历史数据默认 pro
alter table public.entitlements add column if not exists tier text not null default 'pro';
alter table public.redeem_codes add column if not exists tier text not null default 'pro';
do $$ begin
  alter table public.entitlements add constraint entitlements_tier_chk check (tier in ('plus','pro','ultra'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.redeem_codes add constraint redeem_codes_tier_chk check (tier in ('plus','pro','ultra'));
exception when duplicate_object then null; end $$;

-- 行级安全
alter table public.entitlements enable row level security;
alter table public.redeem_codes enable row level security;
alter table public.admins        enable row level security;

-- 权益：用户仅能读自己那行；无写策略（默认拒绝）→ 只能经函数写
drop policy if exists "read own entitlement" on public.entitlements;
create policy "read own entitlement" on public.entitlements
  for select using (auth.uid() = user_id);
-- redeem_codes / admins：无策略 = 客户端读写一律拒绝（只走函数）

-- 套餐 → 月数
create or replace function public.plan_months(p_plan text) returns int
  language sql immutable as $$
  select case p_plan when 'monthly' then 1 when 'quarterly' then 3 when 'annual' then 12 else 0 end
$$;

-- 档位是否合法
create or replace function public.tier_valid(p_tier text) returns boolean
  language sql immutable as $$ select p_tier in ('plus','pro','ultra') $$;

-- 当前登录用户是否店主
create or replace function public.is_admin() returns boolean
  language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- 读“我的权益”（到期则派生为 free；status 即生效档位 plus/pro/ultra）
drop function if exists public.my_entitlement();
create or replace function public.my_entitlement()
  returns table(plan text, status text, expires_at timestamptz, tier text)
  language sql security definer set search_path = public stable as $$
  select e.plan,
         case when e.expires_at is not null and e.expires_at > now() then coalesce(e.tier,'pro') else 'free' end,
         e.expires_at,
         coalesce(e.tier,'pro')
  from public.entitlements e
  where e.user_id = auth.uid()
$$;

-- 店主：铸造一个兑换码（带档位）
drop function if exists public.mint_code(text);
create or replace function public.mint_code(p_plan text, p_tier text default 'pro') returns text
  language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if public.plan_months(p_plan) = 0 then raise exception 'invalid plan'; end if;
  if not public.tier_valid(p_tier) then raise exception 'invalid tier'; end if;
  v_code := 'HJ-' || upper(substr(p_tier,1,2)) || upper(substr(p_plan,1,1)) || '-' || upper(substr(md5(gen_random_uuid()::text),1,8));
  insert into public.redeem_codes(code, plan, tier) values (v_code, p_plan, p_tier);
  return v_code;
end $$;

-- 店主：批量铸造兑换码（带档位）
drop function if exists public.mint_codes(text, int);
create or replace function public.mint_codes(p_plan text, p_count int default 5, p_tier text default 'pro')
  returns text[]
  language plpgsql security definer set search_path = public as $$
declare v_codes text[] := '{}'; v_code text; i int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if public.plan_months(p_plan) = 0 then raise exception 'invalid plan'; end if;
  if not public.tier_valid(p_tier) then raise exception 'invalid tier'; end if;
  if p_count < 1 or p_count > 20 then raise exception 'count must be 1-20'; end if;
  for i in 1..p_count loop
    v_code := 'HJ-' || upper(substr(p_tier,1,2)) || upper(substr(p_plan,1,1)) || '-' || upper(substr(md5(gen_random_uuid()::text),1,8));
    insert into public.redeem_codes(code, plan, tier) values (v_code, p_plan, p_tier);
    v_codes := v_codes || v_code;
  end loop;
  return v_codes;
end $$;

-- 用户：核销兑换码（原子、防重复、可叠加续期；写入档位）
drop function if exists public.redeem_code(text);
create or replace function public.redeem_code(p_code text)
  returns table(plan text, expires_at timestamptz, tier text)
  language plpgsql security definer set search_path = public as $$
declare v_rc public.redeem_codes; v_uid uuid := auth.uid(); v_m int; v_exp timestamptz; v_tier text;
begin
  if v_uid is null then raise exception 'login required'; end if;
  select * into v_rc from public.redeem_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'invalid code'; end if;
  if v_rc.used_by is not null then raise exception 'code already used'; end if;
  update public.redeem_codes set used_by = v_uid, used_at = now() where code = v_rc.code;
  v_m := public.plan_months(v_rc.plan);
  v_tier := coalesce(v_rc.tier, 'pro');
  select greatest(coalesce(e.expires_at, now()), now()) into v_exp
    from public.entitlements e where e.user_id = v_uid;
  v_exp := coalesce(v_exp, now()) + (v_m || ' months')::interval;
  insert into public.entitlements(user_id, plan, tier, started_at, expires_at, source, updated_at)
    values (v_uid, v_rc.plan, v_tier, now(), v_exp, 'redeem', now())
  on conflict (user_id) do update
    set plan = v_rc.plan, tier = v_tier, expires_at = v_exp, source = 'redeem', updated_at = now();
  return query select v_rc.plan, v_exp, v_tier;
end $$;

-- 店主：按邮箱直接开通（带档位；对方需先用该邮箱登录过一次）
drop function if exists public.admin_grant(text, text);
create or replace function public.admin_grant(p_email text, p_plan text, p_tier text default 'pro')
  returns table(plan text, expires_at timestamptz, tier text)
  language plpgsql security definer set search_path = public as $$
declare v_target uuid; v_m int; v_exp timestamptz;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  v_m := public.plan_months(p_plan);
  if v_m = 0 then raise exception 'invalid plan'; end if;
  if not public.tier_valid(p_tier) then raise exception 'invalid tier'; end if;
  select id into v_target from auth.users where lower(email) = lower(trim(p_email));
  if v_target is null then raise exception 'user not found'; end if;
  select greatest(coalesce(e.expires_at, now()), now()) into v_exp
    from public.entitlements e where e.user_id = v_target;
  v_exp := coalesce(v_exp, now()) + (v_m || ' months')::interval;
  insert into public.entitlements(user_id, plan, tier, started_at, expires_at, source, updated_at)
    values (v_target, p_plan, p_tier, now(), v_exp, 'grant', now())
  on conflict (user_id) do update
    set plan = p_plan, tier = p_tier, expires_at = v_exp, source = 'grant', updated_at = now();
  return query select p_plan, v_exp, p_tier;
end $$;

-- 仅允许“已登录用户”调用这些函数
grant execute on function public.my_entitlement()                 to authenticated;
grant execute on function public.redeem_code(text)                to authenticated;
grant execute on function public.mint_code(text, text)            to authenticated;
grant execute on function public.mint_codes(text, int, text)      to authenticated;
grant execute on function public.admin_grant(text, text, text)    to authenticated;
grant execute on function public.tier_valid(text)                 to authenticated;
grant execute on function public.is_admin()                       to authenticated;

-- ============================================================================
-- Phase 2: 云端同步
-- ============================================================================

-- 记录同步表：每笔记录一行，以 (user_id, record_id) 唯一
create table if not exists public.records (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  record_id  text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  deleted    boolean not null default false,
  unique(user_id, record_id)
);

alter table public.records enable row level security;

-- 用户只能读写自己的记录
drop policy if exists "users manage own records" on public.records;
create policy "users manage own records" on public.records
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 给 authenticated 角色开放 records 表的 select/insert/update
grant select, insert, update on public.records to authenticated;

-- ============================================================================
-- 管理员设置
--
-- 用邮箱登录 App 一次后，运行下面的语句即可成为管理员（按邮箱自动查找 UID）：
-- ============================================================================

insert into public.admins(user_id)
select id from auth.users where lower(email) = 'guruzen1913@gmail.com'
on conflict do nothing;

-- ============================================================================
-- Phase 3: AI 配置表
-- ============================================================================

create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;

-- 配置只有店主可读（AI key 等敏感项不再下发给普通用户；
-- AI 调用走 ai-proxy Edge Function，由服务端 service_role 读取，绕过 RLS）
drop policy if exists "authenticated read config" on public.app_config;
drop policy if exists "admin read config" on public.app_config;
create policy "admin read config" on public.app_config
  for select to authenticated using (public.is_admin());

drop policy if exists "admins write config" on public.app_config;
create policy "admins write config" on public.app_config
  for all to authenticated using (public.is_admin())
  with check (public.is_admin());

grant select on public.app_config to authenticated;

-- 店主：在 web 端写入 AI 配置（ai_api_key / ai_base_url / ai_model 等）
create or replace function public.admin_set_config(p_key text, p_value text)
  returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.app_config(key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end $$;

grant execute on function public.admin_set_config(text, text) to authenticated;

-- ============================================================================
-- 让 PostgREST 立即重新加载函数签名（新增 p_tier / admin_set_config 后需要）
-- ============================================================================
notify pgrst, 'reload schema';
