-- Teslimat bölgeleri panelden yönetilir: settings tekil satırına jsonb kolon.
--
-- Neden settings içinde ayrı tablo değil: bölge listesi kısa (10-20 kayıt), her zaman
-- TOPLU okunur/yazılır ve panelde tek formda düzenlenir. Ayrı tablo + RLS + realtime
-- maliyeti karşılığında hiçbir şey kazandırmıyordu.
--
-- Kayıt YOKSA site koddaki varsayılanı kullanır (lib/zones.ts ZONES) — bu yüzden
-- default '[]' değil NULL: boş dizi "bölge yok" demek olurdu, NULL "ayarlanmadı".

alter table public.settings
  add column if not exists zones jsonb;

-- RLS zaten 0003'te kuruldu ve bu kolon için de geçerli:
--   anon → SELECT açık  (müşteri tarafı bölgeleri okur)
--   anon → INSERT/UPDATE YOK (yazma yalnızca service_role, /api/panel/settings üzerinden)
-- Aşağıdaki iki komut idempotent; politikanın varlığını garanti eder.
alter table public.settings enable row level security;

drop policy if exists "settings anon read" on public.settings;
create policy "settings anon read" on public.settings
  for select to anon using (true);

-- Realtime: settings 0003'te yayına eklendi; burada varlığı garanti edilir.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'
    ) then
      alter publication supabase_realtime add table public.settings;
    end if;
  end if;
end $$;
