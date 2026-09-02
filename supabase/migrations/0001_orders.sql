-- MAG Street Food — siparişler ve push abonelikleri (Faz 3)
-- Supabase SQL Editor'da çalıştır (ya da `supabase db push`).

create extension if not exists pgcrypto;

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
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null
);

-- RLS
alter table public.orders enable row level security;
alter table public.push_subscriptions enable row level security;

-- anon: yalnızca sipariş ekleyebilir (okuyamaz, değiştiremez)
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

-- push abonelikleri: yalnızca authenticated (panel). Sunucu service role ile gönderir (RLS'yi geçer).
drop policy if exists "auth all push" on public.push_subscriptions;
create policy "auth all push" on public.push_subscriptions
  for all to authenticated using (true) with check (true);

-- Realtime: orders değişikliklerini yayınla (panel canlı akış)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
