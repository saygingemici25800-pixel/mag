-- ============================================================================
-- MAG Street Food — KURULUM KONTROLÜ
--
-- supabase/SETUP.sql çalıştıktan sonra bunu çalıştır. Tek tablo döner:
-- her satır bir gereksinim, "durum" sütunu OK ya da EKSİK.
-- Hepsi OK ise panel canlıya hazırdır.
-- ============================================================================

with kontrol(sira, ne, gecti, detay) as (

  -- --- tablolar ---
  select 1, 'Tablo: orders',
         to_regclass('public.orders') is not null,
         'siparişler'
  union all
  select 2, 'Tablo: push_subscriptions',
         to_regclass('public.push_subscriptions') is not null,
         'web push abonelikleri'
  union all
  select 3, 'Tablo: settings',
         to_regclass('public.settings') is not null,
         'panel ayarları (açık/kapalı, tükendi)'

  -- --- ödeme kolonları (0002) ---
  union all
  select 4, 'Kolon: orders.payment_status',
         exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'orders' and column_name = 'payment_status'),
         'awaiting_payment / paid / payment_failed'
  union all
  select 5, 'Kolon: orders.payment_ref + locale',
         (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'orders'
            and column_name in ('payment_ref','locale')) = 2,
         'ödeme referansı ve dil'

  -- --- panel kolonları (0003) ---
  union all
  select 6, 'Kolon: panel aşama damgaları',
         (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'orders'
            and column_name in ('prep_minutes','accepted_at','closed_at','cancelled_at')) = 4,
         'prep_minutes, accepted_at, closed_at, cancelled_at'

  -- --- settings singleton satırı ---
  union all
  select 7, 'Satır: settings singleton',
         exists (select 1 from public.settings where id = 'singleton'),
         coalesce(
           (select 'ordering_open=' || ordering_open || ', tükendi=' || jsonb_array_length(sold_out)
            from public.settings where id = 'singleton'),
           'satır yok')

  -- --- RLS açık mı ---
  union all
  select 8, 'RLS: orders',
         coalesce((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), false),
         'row level security'
  union all
  select 9, 'RLS: push_subscriptions',
         coalesce((select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass), false),
         'row level security'
  union all
  select 10, 'RLS: settings',
         coalesce((select relrowsecurity from pg_class where oid = 'public.settings'::regclass), false),
         'row level security'

  -- --- politikalar ---
  union all
  select 11, 'Politika: anon sipariş ekleyebilir',
         exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'orders' and policyname = 'anon insert orders'),
         'site sipariş oluşturur'
  union all
  select 12, 'Politika: settings anon okur',
         exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'settings' and policyname = 'settings anon read'),
         'site kapalı/tükendi bilgisini okur'

  -- --- realtime ---
  union all
  select 13, 'Realtime: yayın var',
         exists (select 1 from pg_publication where pubname = 'supabase_realtime'),
         'supabase_realtime'
  union all
  select 14, 'Realtime: orders yayında',
         exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'),
         'panel yeni siparişi anında görür'
  union all
  select 15, 'Realtime: settings yayında',
         exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'),
         'ayar değişimi anında yayılır'
)
select
  ne                                        as "kontrol",
  case when gecti then 'OK' else 'EKSİK' end as "durum",
  detay                                     as "açıklama"
from kontrol
order by sira;
