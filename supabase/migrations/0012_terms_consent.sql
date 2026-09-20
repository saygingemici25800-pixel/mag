-- Mesafeli satış onayı — sipariş kaydına YAZILIR (uyuşmazlıkta kanıt).
--
-- Mesafeli Sözleşmeler Yönetmeliği: tüketici, sipariş onayından ÖNCE ön
-- bilgilendirmeyi ve sözleşmeyi okuyup kabul etmiş olmalı. Sözleşme metni zaten
-- "ALICI siparişi onaylamakla kabul etmiş sayılır" diyordu ama onayın VERİLDİĞİ
-- hiçbir yerde saklanmıyordu; bu kolonlar o boşluğu kapatıyor.
--
-- terms_accepted_at: onayın alındığı AN (sunucu saati, istemciye güvenilmez).
-- terms_version    : hangi metin sürümü onaylandı (metin değişirse eski
--                    siparişin neyi kabul ettiği belli kalsın).

alter table public.orders
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

comment on column public.orders.terms_accepted_at is
  'Ön bilgilendirme + mesafeli satış sözleşmesi onay zamanı (sunucu saati). NULL = eski kayıt.';
comment on column public.orders.terms_version is
  'Onaylanan yasal metin sürümü (lib/legal.ts LEGAL_FIELDS.TARIH).';
