-- Sistema de Compras - schema inicial Supabase
-- Tabelas para catalogo, lojas, listas, pedidos, aprovacao, recebimento e pedidos concluidos.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('admin', 'comprador', 'loja', 'compras_internas')),
  display_name text not null,
  store_key text check (store_key in ('iconha', 'reta') or store_key is null),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists app_users_role_store_key_idx
  on public.app_users (role, coalesce(store_key, ''));

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit_price numeric(12,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sale_month date not null,
  quantity numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, sale_month)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact text,
  phone text,
  default_terms text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_lists (
  id uuid primary key default gen_random_uuid(),
  store_key text not null check (store_key in ('iconha', 'reta')),
  status text not null default 'open' check (status in ('open', 'converted', 'cancelled')),
  created_at timestamptz not null default now(),
  converted_at timestamptz
);

create unique index if not exists store_lists_one_open_per_store_idx
  on public.store_lists (store_key)
  where status = 'open';

create table if not exists public.store_list_items (
  id uuid primary key default gen_random_uuid(),
  store_list_id uuid not null references public.store_lists(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(12,2) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_list_id, product_id)
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'received', 'completed')),
  supplier_id uuid references public.suppliers(id),
  supplier_name text not null,
  buyer_name text not null,
  source_store_key text check (source_store_key in ('iconha', 'reta') or source_store_key is null),
  priority text not null default 'Normal',
  desired_delivery date,
  installments integer not null default 1 check (installments > 0),
  installment_value numeric(12,2) not null default 0,
  notes text,
  total_value numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_code text not null,
  product_name text not null,
  suggested_quantity numeric(12,2) not null default 1,
  ordered_quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total_value numeric(12,2) generated always as (ordered_quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.purchase_orders(id) on delete cascade,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  order_item_id uuid not null references public.purchase_order_items(id) on delete cascade,
  received_quantity numeric(12,2) not null default 0,
  received_unit_price numeric(12,2) not null default 0,
  received_total_value numeric(12,2) generated always as (received_quantity * received_unit_price) stored,
  created_at timestamptz not null default now(),
  unique (receipt_id, order_item_id)
);

create index if not exists product_sales_product_id_idx on public.product_sales(product_id);
create index if not exists store_list_items_store_list_id_idx on public.store_list_items(store_list_id);
create index if not exists purchase_orders_status_idx on public.purchase_orders(status);
create index if not exists purchase_orders_source_store_key_idx on public.purchase_orders(source_store_key);
create index if not exists purchase_order_items_order_id_idx on public.purchase_order_items(order_id);

insert into public.app_users (role, display_name, store_key)
values
  ('admin', 'Admin', null),
  ('comprador', 'Comprador', null),
  ('loja', 'LOJA ICONHA', 'iconha'),
  ('loja', 'LOJA RETA', 'reta'),
  ('compras_internas', 'Compras internas', null)
on conflict do nothing;

insert into public.suppliers (name, contact, phone, default_terms, notes)
values ('LOJA PETVILLE', null, null, '1 boleto', 'Fornecedor padrao para pedidos criados por Compras Internas')
on conflict (name) do nothing;

insert into public.store_lists (store_key, status)
values ('iconha', 'open'), ('reta', 'open')
on conflict do nothing;
