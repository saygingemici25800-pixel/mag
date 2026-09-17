-- Ürün fiyatları panelden yönetilir: settings tekil satırına jsonb kolon.
--
-- Biçim: { "<urun-id>": <pozitif tam sayı ₺>, ... }  — SEYREK harita.
-- Yalnızca DEĞİŞTİRİLEN ürünler burada durur; olmayan ürün lib/menu.ts'teki
-- fiyatını kullanır. Bu yüzden default '{}' değil NULL: boş nesne "hepsi
-- sıfırlandı" gibi okunabilirdi, NULL "hiç ayarlanmadı" demek.
--
-- Fiyat DOĞRULAMASI uygulamada (pozitif tam sayı + bilinen ürün id'si):
-- /api/panel/settings PATCH + lib/settings normalizePrices. Burada kolon
-- tipinden başka kısıt yok; sipariş tutarı her hâlükârda SUNUCUDA yeniden
-- hesaplanıyor (istemciden fiyat/tutar hiç gelmiyor).

alter table public.settings
  add column if not exists prices jsonb;

-- RLS 0003'te kuruldu ve bu kolon için de geçerli:
--   anon → SELECT açık (menü fiyatını okur), INSERT/UPDATE YOK.
alter table public.settings enable row level security;

drop policy if exists "settings anon read" on public.settings;
create policy "settings anon read" on public.settings
  for select to anon using (true);
