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

-- 当前登录用户是否店主
create or replace function public.is_admin() returns boolean
  language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- 读“我的权益”（到期则派生为 free）
create or replace function public.my_entitlement()
  returns table(plan text, status text, expires_at timestamptz)
  language sql security definer set search_path = public stable as $$
  select e.plan,
         case when e.expires_at is not null and e.expires_at > now() then 'pro' else 'free' end,
         e.expires_at
  from public.entitlements e
  where e.user_id = auth.uid()
$$;

-- 店主：铸造一个兑换码
create or replace function public.mint_code(p_plan text) returns text
  language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if public.plan_months(p_plan) = 0 then raise exception 'invalid plan'; end if;
  v_code := 'HJ-' || upper(substr(p_plan,1,1)) || '-' || upper(substr(md5(gen_random_uuid()::text),1,8));
  insert into public.redeem_codes(code, plan) values (v_code, p_plan);
  return v_code;
end $$;

-- 用户：核销兑换码（原子、防重复、可叠加续期）
create or replace function public.redeem_code(p_code text)
  returns table(plan text, expires_at timestamptz)
  language plpgsql security definer set search_path = public as $$
declare v_rc public.redeem_codes; v_uid uuid := auth.uid(); v_m int; v_exp timestamptz;
begin
  if v_uid is null then raise exception 'login required'; end if;
  select * into v_rc from public.redeem_codes where code = upper(trim(p_code)) for update;
  if not found then raise exception 'invalid code'; end if;
  if v_rc.used_by is not null then raise exception 'code already used'; end if;
  update public.redeem_codes set used_by = v_uid, used_at = now() where code = v_rc.code;
  v_m := public.plan_months(v_rc.plan);
  select greatest(coalesce(e.expires_at, now()), now()) into v_exp
    from public.entitlements e where e.user_id = v_uid;
  v_exp := coalesce(v_exp, now()) + (v_m || ' months')::interval;
  insert into public.entitlements(user_id, plan, started_at, expires_at, source, updated_at)
    values (v_uid, v_rc.plan, now(), v_exp, 'redeem', now())
  on conflict (user_id) do update
    set plan = v_rc.plan, expires_at = v_exp, source = 'redeem', updated_at = now();
  return query select v_rc.plan, v_exp;
end $$;

-- 店主：按邮箱直接开通（对方需先用该邮箱登录过一次）
create or replace function public.admin_grant(p_email text, p_plan text)
  returns table(plan text, expires_at timestamptz)
  language plpgsql security definer set search_path = public as $$
declare v_target uuid; v_m int; v_exp timestamptz;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  v_m := public.plan_months(p_plan);
  if v_m = 0 then raise exception 'invalid plan'; end if;
  select id into v_target from auth.users where lower(email) = lower(trim(p_email));
  if v_target is null then raise exception 'user not found'; end if;
  select greatest(coalesce(e.expires_at, now()), now()) into v_exp
    from public.entitlements e where e.user_id = v_target;
  v_exp := coalesce(v_exp, now()) + (v_m || ' months')::interval;
  insert into public.entitlements(user_id, plan, started_at, expires_at, source, updated_at)
    values (v_target, p_plan, now(), v_exp, 'grant', now())
  on conflict (user_id) do update
    set plan = p_plan, expires_at = v_exp, source = 'grant', updated_at = now();
  return query select p_plan, v_exp;
end $$;

-- 仅允许“已登录用户”调用这些函数
grant execute on function public.my_entitlement()           to authenticated;
grant execute on function public.redeem_code(text)          to authenticated;
grant execute on function public.mint_code(text)            to authenticated;
grant execute on function public.admin_grant(text, text)    to authenticated;
grant execute on function public.is_admin()                 to authenticated;

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
