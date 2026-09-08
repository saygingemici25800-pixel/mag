-- Malzeme çıkarma: sipariş kalemlerinde "removed" listesi.
--
-- orders.items zaten JSONB olduğu için ŞEMA DEĞİŞİKLİĞİ GEREKMİYOR: yeni kalemler
--   { id, name, price, qty, note?, removed?: string[] }
-- biçiminde yazılır, eski kayıtlar (removed alanı olmayan) olduğu gibi geçerli kalır.
--
-- Bu migration yalnızca belgeleme ve doğrulama içindir; veriye dokunmaz.

-- Kalemlerin beklenen biçimde olduğunu doğrula (bilgi amaçlı, hata vermez).
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from public.orders
  where jsonb_typeof(items) <> 'array';
  if bad_count > 0 then
    raise notice 'UYARI: % siparişte items dizisi değil', bad_count;
  end if;
end $$;

-- Panelin "Çıkarılan: ..." bilgisini hızlı bulabilmesi için (isteğe bağlı, küçük tablolarda etkisiz).
create index if not exists orders_items_gin on public.orders using gin (items jsonb_path_ops);
