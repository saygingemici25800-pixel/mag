-- Kurye ve gel-al servisleri BAĞIMSIZ açılıp kapanabilsin.
--
-- ordering_open ANA ŞALTER olarak kalır (ikisini birden kapatır); bu iki kolon
-- yalnızca ana şalter açıkken anlamlıdır. Mantık lib/settings.ts içinde tek
-- yerde: deliveryOpen() / pickupOpen() / allClosed() / typeOpen().
--
-- default true: mevcut satır ve yeni kurulum AÇIK başlar — migration sonrası
-- hiçbir servis kazara kapanmaz. Kolon eksikken de site çalışır
-- (normalizeSettings boolean değilse varsayılanı AÇIK kabul eder).

alter table public.settings
  add column if not exists delivery_open boolean not null default true,
  add column if not exists pickup_open   boolean not null default true;

-- RLS 0003'te kuruldu ve bu kolonlar için de geçerli: anon SELECT açık,
-- yazma yalnızca service_role (/api/panel/settings PATCH).
alter table public.settings enable row level security;

drop policy if exists "settings anon read" on public.settings;
create policy "settings anon read" on public.settings
  for select to anon using (true);
