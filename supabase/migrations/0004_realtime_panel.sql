-- Panel realtime: authenticated rolü orders'ı OKUYABİLİR, anon OKUYAMAZ.
--
-- Neden gerekli: Supabase realtime, WAL'dan gelen satırı ABONENİN rolüyle RLS'ten geçirir.
-- Panel tarayıcıda kısa ömürlü, role="authenticated" bir JWT ile dinler (/api/panel/realtime-token,
-- PANEL_KEY çerezi karşılığında imzalanır). anon'a hiçbir okuma açılmaz — site yalnızca
-- sipariş EKLER ve settings okur.
--
-- 0001'de zaten "auth select orders" politikası vardı; burada varlığı garanti edilir (idempotent).

alter table public.orders enable row level security;

drop policy if exists "auth select orders" on public.orders;
create policy "auth select orders" on public.orders
  for select to authenticated using (true);

-- anon SELECT politikası OLMAMALI: varsa kaldırılır (yanlışlıkla eklenmiş olabilir).
drop policy if exists "anon select orders" on public.orders;
drop policy if exists "orders anon read" on public.orders;

-- Realtime yayınında olduğundan emin ol (0003 ile aynı; tekrar çalıştırılabilir).
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
end $$;
