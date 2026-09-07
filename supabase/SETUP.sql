-- ============================================================================
-- MAG Street Food — TEK DOSYA KURULUM
--
-- supabase/migrations/0001_orders.sql + 0002_payments.sql + 0003_panel.sql
-- birleştirilmiş hâli. Supabase → SQL Editor → New query → yapıştır → Run.
--
-- Tekrar çalıştırılabilir (idempotent): var olan tablo/kolon/politika/index
-- yeniden oluşturulmaz, veri silinmez. Kurulumdan sonra supabase/VERIFY.sql
-- ile durumu kontrol edebilirsin.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) TABLOLAR
-- ---------------------------------------------------------------------------

-- Siparişler. Fiyatlar sunucuda hesaplanır (istemciye güvenilmez); items JSON.
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  type          text not null check (type in ('pickup','delivery')),
  zone          text,
  items         jsonb not null,
  subtotal      integer not null,
  fee           integer not null default 0,
  total         integer not null,
  name          text not null,
  phone         text not null,
  address       text,
  requested_at  text not null,
  note          text,
  payment       text not null check (payment in ('cod','card_on_delivery','online')),
  status        text not null default 'received'
                check (status in ('received','preparing','ready','on_the_way','delivered','cancelled')),
  cancel_reason text
);

-- Web Push abonelikleri (panel kapalıyken bildirim).
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null
);

-- Panel ayarları — TEK SATIR (id = 'singleton'): sipariş açık/kapalı + tükendi listesi.
create table if not exists public.settings (
  id            text primary key default 'singleton',
  ordering_open boolean not null default true,
  sold_out      jsonb   not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) KOLON EKLERİ (0002 ödeme + 0003 panel)
--    Var olan kurulumda da güvenle çalışır: add column if not exists.
-- ---------------------------------------------------------------------------

-- Ödeme: sipariş awaiting_payment ile açılır, callback'te paid / payment_failed olur.
alter table public.orders
  add column if not exists payment_status text not null default 'awaiting_payment'
    check (payment_status in ('awaiting_payment','paid','payment_failed')),
  add column if not exists payment_ref text,
  add column if not exists locale text not null default 'tr' check (locale in ('tr','en'));

-- Panel üç aşamalı akış: hazırlanma süresi ve aşama zaman damgaları.
alter table public.orders
  add column if not exists prep_minutes integer,      -- "Siparişi al" anında girilen dakika
  add column if not exists accepted_at  timestamptz,  -- YENİ → HAZIR
  add column if not exists closed_at    timestamptz,  -- HAZIR → KAPANDI (yola çıktı / teslim edildi)
  add column if not exists cancelled_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3) INDEXLER
-- ---------------------------------------------------------------------------
create index if not exists orders_created_at_idx     on public.orders (created_at desc);
create index if not exists orders_status_idx         on public.orders (status);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_accepted_at_idx    on public.orders (accepted_at);

-- ---------------------------------------------------------------------------
-- 4) SETTINGS SINGLETON SATIRI
--    Zaten varsa dokunulmaz (mevcut ayarlar korunur).
-- ---------------------------------------------------------------------------
insert into public.settings (id) values ('singleton')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 5) RLS (Row Level Security)
--    Panel service_role ile bağlanır ve RLS'yi geçer; aşağıdaki politikalar
--    yalnızca anon (site ziyaretçisi) ve authenticated içindir.
-- ---------------------------------------------------------------------------
alter table public.orders             enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.settings           enable row level security;

-- anon: yalnızca sipariş EKLER (okuyamaz, değiştiremez)
drop policy if exists "anon insert orders" on public.orders;
create policy "anon insert orders" on public.orders
  for insert to anon with check (true);

-- authenticated (işletme sahibi): okur ve günceller
drop policy if exists "auth select orders" on public.orders;
create policy "auth select orders" on public.orders
  for select to authenticated using (true);

drop policy if exists "auth update orders" on public.orders;
create policy "auth update orders" on public.orders
  for update to authenticated using (true) with check (true);

-- push abonelikleri: yalnızca panel (authenticated). Sunucu service role ile gönderir.
drop policy if exists "auth all push" on public.push_subscriptions;
create policy "auth all push" on public.push_subscriptions
  for all to authenticated using (true) with check (true);

-- settings: site yalnızca OKUR (kapalı mıyız / tükendi mi). Yazma yalnızca service role.
drop policy if exists "settings anon read" on public.settings;
create policy "settings anon read" on public.settings
  for select to anon using (true);

-- ---------------------------------------------------------------------------
-- 6) REALTIME YAYINI
--    Panelin yeni siparişi ve ayar değişimini anında görmesi buna bağlı.
--    Yayın yoksa oluşturulur; tablo zaten ekliyse tekrar eklenmez.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Bitti. Kontrol için: supabase/VERIFY.sql
-- ---------------------------------------------------------------------------
