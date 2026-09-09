-- Rusça (ru) sipariş dili.
--
-- 0002'deki CHECK yalnızca ('tr','en') kabul ediyordu; ru siparişi INSERT sırasında
-- veritabanı tarafından REDDEDİLİRDİ. Derleyici bunu yakalayamaz — hata yalnızca
-- canlıda, gerçek siparişte görülürdü. Bu yüzden kısıt yeniden kuruluyor.
--
-- Tekrar çalıştırılabilir: kısıt adı sabit, önce düşürülüp sonra ekleniyor.

do $$
declare
  cname text;
begin
  -- 0002 kısıtı isimsiz oluşturmuş olabilir; locale sütununa bağlı CHECK'i bul ve düşür.
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'orders' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%locale%'
  loop
    execute format('alter table public.orders drop constraint %I', cname);
  end loop;
end $$;

alter table public.orders
  add constraint orders_locale_check check (locale in ('tr', 'en', 'ru'));
