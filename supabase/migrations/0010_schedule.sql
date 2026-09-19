-- Çalışma saatleri ve özel günler (tatil/bayram) panelden yönetilir.
--
-- Biçim: { "week": [ {day,openMin,closeMin} × 7 ], "special": [ {date,closed,openMin?,closeMin?,note?} ] }
--   openMin/closeMin: gün başından DAKİKA. 12:00 → 720, 00:00 kapanış → 1440.
--   closeMin > openMin kuralı; gece yarısını geçen pencere zaten 1440+ olduğu için sağlanır.
--   Kapalı gün: openMin === closeMin === 0.
--   special[].date: "YYYY-MM-DD" (Istanbul takvimi).
--
-- NULL = "hiç ayarlanmadı" → kod varsayılanı (lib/hours.ts HOURS) geçerli.
-- Doğrulama uygulamada: lib/settings.ts normalizeSchedule + /api/panel/settings PATCH.

alter table public.settings
  add column if not exists schedule jsonb;

-- RLS 0003'te kuruldu, bu kolon için de geçerli: anon SELECT açık, yazma yalnızca service_role.
alter table public.settings enable row level security;

drop policy if exists "settings anon read" on public.settings;
create policy "settings anon read" on public.settings
  for select to anon using (true);
