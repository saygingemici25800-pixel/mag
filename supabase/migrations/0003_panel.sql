-- Panel: üç aşamalı akış için zaman damgaları + hazırlanma süresi, ve panel ayarları (settings).
-- Mevcut şema bozulmaz: yalnızca kolon/tablo eklenir, status check listesi genişletilir.

-- 1) Sipariş: aşama zaman damgaları ve hazırlanma süresi
alter table public.orders
  add column if not exists prep_minutes  integer,                 -- "Siparişi al" anında girilen dakika
  add column if not exists accepted_at   timestamptz,             -- YENİ → HAZIR
  add column if not exists closed_at     timestamptz,             -- HAZIR → KAPANDI (yola çıktı / teslim edildi)
  add column if not exists cancelled_at  timestamptz;

create index if not exists orders_accepted_at_idx on public.orders (accepted_at);
create index if not exists orders_created_at_idx  on public.orders (created_at desc);

-- 2) Panel ayarları — tek satır (id = 'singleton')
create table if not exists public.settings (
  id            text primary key default 'singleton',
  ordering_open boolean not null default true,
  sold_out      jsonb   not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

insert into public.settings (id) values ('singleton') on conflict (id) do nothing;

-- RLS: panel servis anahtarıyla erişir (service role RLS'yi geçer).
-- Site tarafı yalnızca OKUR (kapalı mıyız / tükendi mi) — anon select açık, yazma kapalı.
alter table public.settings enable row level security;

drop policy if exists "settings anon read" on public.settings;
create policy "settings anon read" on public.settings
  for select to anon using (true);

-- 3) Realtime: panel yeni siparişi ve ayar değişimini anında görsün
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.orders;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.settings;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
