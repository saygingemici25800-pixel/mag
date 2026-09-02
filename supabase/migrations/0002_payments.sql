-- Faz 5: yalnızca online ödeme. Sipariş awaiting_payment ile açılır, callback'te paid / payment_failed olur.
alter table public.orders
  add column if not exists payment_status text not null default 'awaiting_payment'
    check (payment_status in ('awaiting_payment','paid','payment_failed')),
  add column if not exists payment_ref text,
  add column if not exists locale text not null default 'tr' check (locale in ('tr','en'));
create index if not exists orders_payment_status_idx on public.orders (payment_status);
