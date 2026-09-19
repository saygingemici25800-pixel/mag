-- Panel raporları — geçmiş sipariş verisi, toplama VERİTABANINDA yapılır.
--
-- Neden SQL fonksiyonu: tüm siparişleri tarayıcıya indirip orada toplamak
-- sipariş sayısı büyüdükçe çöker. Burada satırlar Postgres'te toplanır,
-- tarayıcıya yalnızca ÖZET gider (birkaç yüz bayt).
--
-- SAAT DİLİMİ: gün kırılımı `at time zone 'Europe/Istanbul'` ile yapılır.
-- created_at timestamptz (UTC) saklanıyor; UTC'ye göre gruplansaydı gece
-- 00:10'daki sipariş bir ÖNCEKİ güne yazılırdı (TR = UTC+3).
--
-- İPTALLER: ciroya girmez. is_paid/ciro hesapları status <> 'cancelled' ve
-- payment_status = 'paid' koşuluyla; iptaller ayrı sayılır.

-- Rapor sorguları created_at aralığı + status filtresiyle çalışıyor.
-- orders_created_at_idx (0001) ve orders_status_idx (0001) zaten var.
-- Aralık taraması için (created_at, status) bileşik indeksi ekleniyor:
-- tek indeksle hem aralık daraltma hem iptal ayıklama yapılabilsin.
create index if not exists orders_created_status_idx
  on public.orders (created_at desc, status);

-- items jsonb için GIN indeksi 0003_panel.sql'de ZATEN VAR (orders_items_gin,
-- jsonb_path_ops). İkincisini eklemek yazma maliyetini ve diski boşuna artırır —
-- eklenmiyor. (İlk yazımda eklenmişti, ölçüm sırasında fark edilip kaldırıldı.)
--
-- Not: ürün kırılımı zaten jsonb_array_elements ile TÜM aralığı açıyor; burada
-- GIN'in faydası yok (indeks arama için, açma için değil). Aralığı daraltan
-- created_at indeksi belirleyici olan.

/* Tek çağrıda tüm rapor: özet + günlük + saatlik + ürün + mahalle.
   Tek fonksiyon çünkü hepsi AYNI aralık ve AYNI filtreyi paylaşıyor;
   beş ayrı rota beş kez aynı taramayı yapardı.

   p_from / p_to: "YYYY-MM-DD" (İstanbul takvimi), her ikisi de DAHİL.
   Yarı açık aralığa çevrilir: [p_from 00:00 TR, p_to+1 00:00 TR) */
create or replace function public.panel_report(p_from text, p_to text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with sinirlar as (
  select
    (p_from::date)::timestamp at time zone 'Europe/Istanbul' as bas,
    ((p_to::date + 1))::timestamp at time zone 'Europe/Istanbul' as bit
),
-- Aralıktaki TÜM siparişler (iptaller dahil — ayrı sayılacak)
kapsam as (
  select o.*,
         ((o.created_at at time zone 'Europe/Istanbul')::date)::text as gun,
         extract(hour from (o.created_at at time zone 'Europe/Istanbul'))::int as saat
  from public.orders o, sinirlar s
  where o.created_at >= s.bas and o.created_at < s.bit
),
-- Ciroya giren: iptal DEĞİL ve ödemesi alınmış
gecerli as (
  select * from kapsam
  where status <> 'cancelled' and payment_status = 'paid'
),
ozet as (
  select
    (select count(*) from gecerli)                              as orders,
    (select coalesce(sum(total),0) from gecerli)                as revenue,
    (select count(*) from gecerli where type = 'delivery')      as delivery,
    (select count(*) from gecerli where type = 'pickup')        as pickup,
    (select count(*) from kapsam where status = 'cancelled')    as cancelled,
    (select count(*) from kapsam)                               as total_all
),
gunluk as (
  select gun as date, count(*)::int as orders, coalesce(sum(total),0)::int as revenue
  from gecerli group by gun order by gun
),
saatlik as (
  select saat as hour, count(*)::int as orders, coalesce(sum(total),0)::int as revenue
  from gecerli group by saat order by saat
),
-- items jsonb dizisi: her ürün satırı açılır, id/ad/adet üzerinden toplanır.
-- Ciro: satırdaki price * qty (sipariş anındaki fiyat — sonraki zam eski raporu bozmaz).
urunler as (
  select
    it->>'id'                                             as id,
    max(it->>'name')                                      as name,
    sum((it->>'qty')::int)::int                           as qty,
    sum(coalesce((it->>'price')::int,0) * (it->>'qty')::int)::int as revenue
  from gecerli g, lateral jsonb_array_elements(g.items) as it
  group by it->>'id'
  order by qty desc, revenue desc
  limit 10
),
mahalleler as (
  select coalesce(zone,'-') as zone, count(*)::int as orders, coalesce(sum(total),0)::int as revenue
  from gecerli where type = 'delivery'
  group by coalesce(zone,'-') order by count(*) desc
)
select jsonb_build_object(
  'from', p_from,
  'to', p_to,
  'summary', (select to_jsonb(o) from ozet o),
  'daily', coalesce((select jsonb_agg(to_jsonb(d)) from gunluk d), '[]'::jsonb),
  'hourly', coalesce((select jsonb_agg(to_jsonb(h)) from saatlik h), '[]'::jsonb),
  'items', coalesce((select jsonb_agg(to_jsonb(u)) from urunler u), '[]'::jsonb),
  'zones', coalesce((select jsonb_agg(to_jsonb(m)) from mahalleler m), '[]'::jsonb)
);
$$;

/* CSV için ham liste — yine SUNUCUDA süzülür, sayfalama yok çünkü
   dışa aktarma tek seferlik ve aralıkla sınırlı. */
create or replace function public.panel_report_rows(p_from text, p_to text)
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select o.*
  from public.orders o
  where o.created_at >= (p_from::date)::timestamp at time zone 'Europe/Istanbul'
    and o.created_at <  ((p_to::date + 1))::timestamp at time zone 'Europe/Istanbul'
  order by o.created_at desc;
$$;

-- Bu fonksiyonlar security definer: RLS'yi aşarlar. Bu yüzden anon/authenticated'a
-- AÇILMAZ — yalnızca service_role çağırabilir (panel API rotası service_role kullanıyor).
revoke all on function public.panel_report(text, text) from public, anon, authenticated;
revoke all on function public.panel_report_rows(text, text) from public, anon, authenticated;
grant execute on function public.panel_report(text, text) to service_role;
grant execute on function public.panel_report_rows(text, text) to service_role;
