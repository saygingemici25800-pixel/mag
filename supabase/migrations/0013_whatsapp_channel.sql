-- WhatsApp sipariş kanalı — GEÇİCİ akış (panel/Supabase akışı DURUYOR, silinmedi).
--
-- Müşteri "WhatsApp'tan Sipariş Ver"e basınca sipariş önce buraya yazılır, sonra
-- wa.me bağlantısı açılır. İşletme WhatsApp'tan gelen sipariş numarasıyla aynı
-- kaydı panelde bulabilsin diye numara KAYITTA da tutulur.
--
-- status='whatsapp': mevcut durumlarla KARIŞMASIN diye ayrı bir değer. Panel bu
-- siparişleri göstermeye devam eder (OPEN_STATUSES'a eklendi) ama üç aşamalı
-- akışın dışındadır — işletme WhatsApp'ta konuşup panelden ilerletir.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('received','preparing','ready','on_the_way','delivered','cancelled','whatsapp'));

-- Müşteriye ve WhatsApp mesajına gösterilen KISA numara (6 karakter, harf+rakam).
-- uuid'in ilk 8 hanesi okunaksızdı; telefonda okunup panelde aranacak bir numara
-- gerekiyor. Benzersizlik: unique index (çakışırsa sunucu yeniden üretir).
alter table public.orders add column if not exists order_code text;
create unique index if not exists orders_order_code_key on public.orders (order_code)
  where order_code is not null;

comment on column public.orders.order_code is
  'WhatsApp mesajındaki kısa sipariş no (6 karakter). Panelde arama için.';
