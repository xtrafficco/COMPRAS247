-- Sistema de Compras v2 - schema normalizado, RLS e auditoria.
-- Execute somente no projeto Supabase correto deste sistema.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create table if not exists public.app_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'comprador', 'loja', 'compras_internas')),
  display_name text not null,
  store_key text check (store_key in ('iconha', 'reta') or store_key is null),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_profiles
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_profiles_role_store_consistency_check'
      and conrelid = 'public.app_profiles'::regclass
  ) then
    alter table public.app_profiles
      add constraint app_profiles_role_store_consistency_check
      check (
        (role = 'loja' and store_key is not null)
        or (role <> 'loja' and store_key is null)
      ) not valid;
  end if;
end;
$$;

create or replace function app_private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.app_profiles p
  where p.auth_user_id = (select auth.uid())
    and p.active is true
  limit 1
$$;

create or replace function app_private.current_store_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.store_key
  from public.app_profiles p
  where p.auth_user_id = (select auth.uid())
    and p.active is true
  limit 1
$$;

create or replace function app_private.parse_legacy_timestamptz(value text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if nullif(btrim(value), '') is null then
    return null;
  end if;
  begin
    return value::timestamptz;
  exception when others then
    begin
      return to_timestamp(replace(value, ',', ''), 'DD/MM/YYYY HH24:MI:SS');
    exception when others then
      return null;
    end;
  end;
end;
$$;

revoke execute on function app_private.current_app_role() from public, anon;
revoke execute on function app_private.current_store_key() from public, anon;
revoke execute on function app_private.parse_legacy_timestamptz(text) from public, anon;
grant execute on function app_private.current_app_role() to authenticated;
grant execute on function app_private.current_store_key() to authenticated;

create table if not exists public.purchase_products (
  id bigint generated always as identity primary key,
  legacy_id bigint unique,
  code text not null,
  name text not null,
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  active boolean not null default true,
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists purchase_products_code_lower_uidx
  on public.purchase_products (lower(code));
create unique index if not exists purchase_products_name_lower_uidx
  on public.purchase_products (lower(name));
create index if not exists purchase_products_active_id_idx
  on public.purchase_products (id) where active is true;
create index if not exists purchase_products_archived_by_idx
  on public.purchase_products (archived_by) where archived_by is not null;

create table if not exists public.purchase_sales (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.purchase_products(id) on delete cascade,
  sale_year smallint not null check (sale_year between 2000 and 2100),
  sale_month smallint not null check (sale_month between 1 and 12),
  quantity numeric(14,2) not null default 0 check (quantity >= 0),
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  unique (product_id, sale_year, sale_month)
);

create index if not exists purchase_sales_year_month_product_idx
  on public.purchase_sales (sale_year, sale_month, product_id);
create index if not exists purchase_sales_imported_by_idx
  on public.purchase_sales (imported_by) where imported_by is not null;

create table if not exists public.purchase_suppliers (
  id bigint generated always as identity primary key,
  legacy_id bigint unique,
  name text not null,
  contact text,
  phone text,
  default_terms text,
  notes text,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists purchase_suppliers_name_lower_uidx
  on public.purchase_suppliers (lower(name));
create index if not exists purchase_suppliers_active_id_idx
  on public.purchase_suppliers (id) where active is true;

create table if not exists public.purchase_settings (
  id text primary key default 'main' check (id = 'main'),
  auto_approval_limit numeric(14,2) not null default 0 check (auto_approval_limit >= 0),
  price_increase_alert_percent numeric(6,2) not null default 10 check (price_increase_alert_percent >= 0),
  require_rejection_reason boolean not null default true,
  mfa_required_admin boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.purchase_settings
  add column if not exists price_increase_alert_percent numeric(6,2) not null default 10
  check (price_increase_alert_percent >= 0);

create table if not exists public.purchase_quotations (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.purchase_products(id) on delete cascade,
  supplier_id bigint not null references public.purchase_suppliers(id) on delete cascade,
  price numeric(14,2) not null check (price > 0),
  delivery_days integer not null default 0 check (delivery_days >= 0),
  notes text,
  quoted_by uuid references auth.users(id) on delete set null,
  quoted_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);

create index if not exists purchase_quotations_product_price_idx
  on public.purchase_quotations (product_id, price);
create index if not exists purchase_quotations_supplier_id_idx
  on public.purchase_quotations (supplier_id);

create table if not exists public.purchase_lists (
  id bigint generated always as identity primary key,
  owner_scope text not null check (owner_scope in ('central', 'iconha', 'reta')),
  status text not null default 'open' check (status in ('open', 'converted', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  converted_at timestamptz
);

create unique index if not exists purchase_lists_one_open_scope_uidx
  on public.purchase_lists (owner_scope) where status = 'open';

create table if not exists public.purchase_list_items (
  id bigint generated always as identity primary key,
  list_id bigint not null references public.purchase_lists(id) on delete cascade,
  product_id bigint not null references public.purchase_products(id),
  quantity numeric(14,2) not null default 1 check (quantity > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, product_id)
);

create index if not exists purchase_list_items_list_id_idx
  on public.purchase_list_items (list_id);
create index if not exists purchase_list_items_product_id_idx
  on public.purchase_list_items (product_id);

create table if not exists public.purchase_v2_orders (
  id bigint generated always as identity primary key,
  legacy_id bigint unique,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'received', 'completed')),
  supplier_id bigint references public.purchase_suppliers(id) on delete set null,
  supplier_name text not null,
  supplier_contact text,
  supplier_phone text,
  supplier_terms text,
  buyer_name text not null,
  source_store_key text check (source_store_key in ('iconha', 'reta') or source_store_key is null),
  priority text not null default 'Normal',
  desired_delivery date,
  installments integer not null default 1 check (installments > 0),
  installment_value numeric(14,2) not null default 0 check (installment_value >= 0),
  notes text,
  approval_type text check (approval_type in ('manual', 'automatic') or approval_type is null),
  decision_reason text,
  total_value numeric(14,2) not null default 0 check (total_value >= 0),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  received_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'rejected' or nullif(btrim(decision_reason), '') is not null)
);

create index if not exists purchase_v2_orders_status_created_idx
  on public.purchase_v2_orders (status, created_at desc);
create index if not exists purchase_v2_orders_source_store_idx
  on public.purchase_v2_orders (source_store_key, created_at desc)
  where source_store_key is not null;
create index if not exists purchase_v2_orders_supplier_id_idx
  on public.purchase_v2_orders (supplier_id) where supplier_id is not null;
create index if not exists purchase_v2_orders_created_by_idx
  on public.purchase_v2_orders (created_by) where created_by is not null;

create table if not exists public.purchase_v2_order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.purchase_v2_orders(id) on delete cascade,
  product_id bigint references public.purchase_products(id) on delete set null,
  product_code text not null,
  product_name text not null,
  suggested_quantity numeric(14,2) not null default 1 check (suggested_quantity >= 0),
  ordered_quantity numeric(14,2) not null default 1 check (ordered_quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  total_value numeric(14,2) generated always as (ordered_quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create index if not exists purchase_v2_order_items_order_id_idx
  on public.purchase_v2_order_items (order_id);
create index if not exists purchase_v2_order_items_product_id_idx
  on public.purchase_v2_order_items (product_id) where product_id is not null;

create table if not exists public.purchase_price_history (
  id bigint generated always as identity primary key,
  legacy_id bigint unique,
  product_id bigint not null references public.purchase_products(id) on delete cascade,
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  source text not null,
  source_order_id bigint references public.purchase_v2_orders(id) on delete set null,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_by_name text not null default 'Sistema',
  recorded_at timestamptz not null default now()
);

create index if not exists purchase_price_history_product_recorded_idx
  on public.purchase_price_history (product_id, recorded_at desc, id desc);
create index if not exists purchase_price_history_source_order_idx
  on public.purchase_price_history (source_order_id)
  where source_order_id is not null;

create table if not exists public.purchase_receipts (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.purchase_v2_orders(id) on delete cascade,
  delivery_number integer not null check (delivery_number > 0),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  total_received numeric(14,2) not null default 0 check (total_received >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, delivery_number)
);

create index if not exists purchase_receipts_confirmed_month_idx
  on public.purchase_receipts (confirmed_at desc);
create index if not exists purchase_receipts_order_id_idx
  on public.purchase_receipts (order_id);

create table if not exists public.purchase_receipt_items (
  id bigint generated always as identity primary key,
  receipt_id bigint not null references public.purchase_receipts(id) on delete cascade,
  order_item_id bigint not null references public.purchase_v2_order_items(id) on delete cascade,
  received_quantity numeric(14,2) not null default 0 check (received_quantity >= 0),
  received_unit_price numeric(14,2) not null default 0 check (received_unit_price >= 0),
  received_total_value numeric(14,2)
    generated always as (received_quantity * received_unit_price) stored,
  created_at timestamptz not null default now(),
  unique (receipt_id, order_item_id)
);

create index if not exists purchase_receipt_items_receipt_id_idx
  on public.purchase_receipt_items (receipt_id);
create index if not exists purchase_receipt_items_order_item_id_idx
  on public.purchase_receipt_items (order_item_id);

create table if not exists public.purchase_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'Sistema',
  area text not null check (area in ('catalog', 'sales', 'supplier', 'list', 'order', 'receipt', 'system')),
  action text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists purchase_audit_created_idx
  on public.purchase_audit_log (created_at desc);
create index if not exists purchase_audit_area_created_idx
  on public.purchase_audit_log (area, created_at desc);
create index if not exists purchase_audit_actor_idx
  on public.purchase_audit_log (actor_user_id, created_at desc)
  where actor_user_id is not null;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists purchase_products_updated_at on public.purchase_products;
create trigger purchase_products_updated_at before update on public.purchase_products
for each row execute function app_private.set_updated_at();
drop trigger if exists app_profiles_updated_at on public.app_profiles;
create trigger app_profiles_updated_at before update on public.app_profiles
for each row execute function app_private.set_updated_at();
drop trigger if exists purchase_suppliers_updated_at on public.purchase_suppliers;
create trigger purchase_suppliers_updated_at before update on public.purchase_suppliers
for each row execute function app_private.set_updated_at();
drop trigger if exists purchase_settings_updated_at on public.purchase_settings;
create trigger purchase_settings_updated_at before update on public.purchase_settings
for each row execute function app_private.set_updated_at();
drop trigger if exists purchase_list_items_updated_at on public.purchase_list_items;
create trigger purchase_list_items_updated_at before update on public.purchase_list_items
for each row execute function app_private.set_updated_at();
drop trigger if exists purchase_v2_orders_updated_at on public.purchase_v2_orders;
create trigger purchase_v2_orders_updated_at before update on public.purchase_v2_orders
for each row execute function app_private.set_updated_at();
drop trigger if exists purchase_receipts_updated_at on public.purchase_receipts;
create trigger purchase_receipts_updated_at before update on public.purchase_receipts
for each row execute function app_private.set_updated_at();

create or replace function app_private.validate_purchase_order_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller_role text;
begin
  if old.status = new.status or (select auth.uid()) is null then
    return new;
  end if;

  caller_role := app_private.current_app_role();
  if caller_role = 'admin' and (
    (old.status = 'pending' and new.status in ('approved', 'rejected'))
    or (old.status = 'approved' and new.status = 'received')
  ) then
    return new;
  end if;
  if caller_role = 'comprador' and old.status = 'approved' and new.status = 'received' then
    return new;
  end if;

  raise exception 'Transicao de pedido nao permitida: % -> %', old.status, new.status
    using errcode = '42501';
end;
$$;

drop trigger if exists purchase_v2_orders_status_transition on public.purchase_v2_orders;
create trigger purchase_v2_orders_status_transition
before update of status on public.purchase_v2_orders
for each row execute function app_private.validate_purchase_order_transition();

create or replace function app_private.sync_purchase_receipt_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_receipt_id bigint;
begin
  target_receipt_id := case when tg_op = 'DELETE' then old.receipt_id else new.receipt_id end;
  update public.purchase_receipts receipt
  set total_received = coalesce((
    select sum(item.received_total_value)
    from public.purchase_receipt_items item
    where item.receipt_id = target_receipt_id
  ), 0)
  where receipt.id = target_receipt_id;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists purchase_receipt_items_sync_total on public.purchase_receipt_items;
create trigger purchase_receipt_items_sync_total
after insert or update or delete on public.purchase_receipt_items
for each row execute function app_private.sync_purchase_receipt_total();

create or replace function app_private.sync_purchase_order_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_order_id bigint;
begin
  target_order_id := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  update public.purchase_v2_orders purchase_order
  set total_value = coalesce((
    select sum(item.total_value)
    from public.purchase_v2_order_items item
    where item.order_id = target_order_id
  ), 0)
  where purchase_order.id = target_order_id;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists purchase_v2_order_items_sync_total on public.purchase_v2_order_items;
create trigger purchase_v2_order_items_sync_total
after insert or update or delete on public.purchase_v2_order_items
for each row execute function app_private.sync_purchase_order_total();

create or replace function app_private.audit_row_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  row_data jsonb;
  actor_label text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  select coalesce(p.display_name, 'Sistema') into actor_label
  from public.app_profiles p
  where p.auth_user_id = (select auth.uid())
  limit 1;

  insert into public.purchase_audit_log (
    actor_user_id, actor_name, area, action, entity_id, details
  ) values (
    (select auth.uid()), coalesce(actor_label, 'Sistema'), tg_argv[0], tg_op,
    coalesce(row_data->>'id', ''), jsonb_build_object('row', row_data)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists purchase_products_audit on public.purchase_products;
create trigger purchase_products_audit after insert or update or delete on public.purchase_products
for each row execute function app_private.audit_row_change('catalog');
drop trigger if exists purchase_suppliers_audit on public.purchase_suppliers;
create trigger purchase_suppliers_audit after insert or update or delete on public.purchase_suppliers
for each row execute function app_private.audit_row_change('supplier');
drop trigger if exists purchase_quotations_audit on public.purchase_quotations;
create trigger purchase_quotations_audit after insert or update or delete on public.purchase_quotations
for each row execute function app_private.audit_row_change('supplier');
drop trigger if exists purchase_settings_audit on public.purchase_settings;
create trigger purchase_settings_audit after insert or update or delete on public.purchase_settings
for each row execute function app_private.audit_row_change('system');
drop trigger if exists purchase_v2_orders_audit on public.purchase_v2_orders;
create trigger purchase_v2_orders_audit after insert or update or delete on public.purchase_v2_orders
for each row execute function app_private.audit_row_change('order');
drop trigger if exists purchase_price_history_audit on public.purchase_price_history;
create trigger purchase_price_history_audit after insert or update or delete on public.purchase_price_history
for each row execute function app_private.audit_row_change('catalog');
drop trigger if exists purchase_receipts_audit on public.purchase_receipts;
create trigger purchase_receipts_audit after insert or update or delete on public.purchase_receipts
for each row execute function app_private.audit_row_change('receipt');

alter table public.app_profiles enable row level security;
alter table public.purchase_products enable row level security;
alter table public.purchase_sales enable row level security;
alter table public.purchase_suppliers enable row level security;
alter table public.purchase_settings enable row level security;
alter table public.purchase_quotations enable row level security;
alter table public.purchase_lists enable row level security;
alter table public.purchase_list_items enable row level security;
alter table public.purchase_v2_orders enable row level security;
alter table public.purchase_v2_order_items enable row level security;
alter table public.purchase_price_history enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;
alter table public.purchase_audit_log enable row level security;

drop policy if exists app_profiles_read_own_or_admin on public.app_profiles;
create policy app_profiles_read_own_or_admin on public.app_profiles for select to authenticated
using (auth_user_id = (select auth.uid()) or (select app_private.current_app_role()) = 'admin');
drop policy if exists app_profiles_admin_write on public.app_profiles;
create policy app_profiles_admin_write on public.app_profiles for all to authenticated
using ((select app_private.current_app_role()) = 'admin')
with check ((select app_private.current_app_role()) = 'admin');

drop policy if exists purchase_products_non_store_read on public.purchase_products;
create policy purchase_products_non_store_read on public.purchase_products for select to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas'));
drop policy if exists purchase_products_admin_write on public.purchase_products;
create policy purchase_products_admin_write on public.purchase_products for all to authenticated
using ((select app_private.current_app_role()) = 'admin')
with check ((select app_private.current_app_role()) = 'admin');

drop policy if exists purchase_sales_non_store_read on public.purchase_sales;
create policy purchase_sales_non_store_read on public.purchase_sales for select to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas'));
drop policy if exists purchase_sales_admin_write on public.purchase_sales;
create policy purchase_sales_admin_write on public.purchase_sales for all to authenticated
using ((select app_private.current_app_role()) = 'admin')
with check ((select app_private.current_app_role()) = 'admin');

drop policy if exists purchase_suppliers_non_store_read on public.purchase_suppliers;
create policy purchase_suppliers_non_store_read on public.purchase_suppliers for select to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas'));
drop policy if exists purchase_suppliers_admin_write on public.purchase_suppliers;
create policy purchase_suppliers_admin_write on public.purchase_suppliers for all to authenticated
using ((select app_private.current_app_role()) = 'admin')
with check ((select app_private.current_app_role()) = 'admin');

drop policy if exists purchase_settings_read on public.purchase_settings;
create policy purchase_settings_read on public.purchase_settings for select to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador'));
drop policy if exists purchase_settings_admin_write on public.purchase_settings;
create policy purchase_settings_admin_write on public.purchase_settings for all to authenticated
using ((select app_private.current_app_role()) = 'admin')
with check ((select app_private.current_app_role()) = 'admin');

drop policy if exists purchase_quotations_read on public.purchase_quotations;
create policy purchase_quotations_read on public.purchase_quotations for select to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador'));
drop policy if exists purchase_quotations_write on public.purchase_quotations;
create policy purchase_quotations_write on public.purchase_quotations for all to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador'))
with check ((select app_private.current_app_role()) in ('admin', 'comprador'));

drop policy if exists purchase_price_history_read on public.purchase_price_history;
create policy purchase_price_history_read on public.purchase_price_history for select to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas'));
drop policy if exists purchase_price_history_write on public.purchase_price_history;
create policy purchase_price_history_write on public.purchase_price_history for all to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador'))
with check ((select app_private.current_app_role()) in ('admin', 'comprador'));

drop policy if exists purchase_lists_read on public.purchase_lists;
create policy purchase_lists_read on public.purchase_lists for select to authenticated
using (
  (select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas')
  or ((select app_private.current_app_role()) = 'loja' and owner_scope = (select app_private.current_store_key()))
);
drop policy if exists purchase_lists_write on public.purchase_lists;
create policy purchase_lists_write on public.purchase_lists for all to authenticated
using (
  ((select app_private.current_app_role()) in ('admin', 'comprador') and owner_scope = 'central')
  or ((select app_private.current_app_role()) = 'compras_internas' and owner_scope in ('iconha', 'reta'))
  or ((select app_private.current_app_role()) = 'loja' and owner_scope = (select app_private.current_store_key()))
)
with check (
  ((select app_private.current_app_role()) in ('admin', 'comprador') and owner_scope = 'central')
  or ((select app_private.current_app_role()) = 'compras_internas' and owner_scope in ('iconha', 'reta'))
  or ((select app_private.current_app_role()) = 'loja' and owner_scope = (select app_private.current_store_key()))
);

drop policy if exists purchase_list_items_read on public.purchase_list_items;
create policy purchase_list_items_read on public.purchase_list_items for select to authenticated
using (exists (
  select 1 from public.purchase_lists l
  where l.id = purchase_list_items.list_id
    and (
      (select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas')
      or ((select app_private.current_app_role()) = 'loja' and l.owner_scope = (select app_private.current_store_key()))
    )
));
drop policy if exists purchase_list_items_write on public.purchase_list_items;
create policy purchase_list_items_write on public.purchase_list_items for all to authenticated
using (exists (
  select 1 from public.purchase_lists l
  where l.id = purchase_list_items.list_id
    and (
      ((select app_private.current_app_role()) in ('admin', 'comprador') and l.owner_scope = 'central')
      or ((select app_private.current_app_role()) = 'compras_internas' and l.owner_scope in ('iconha', 'reta'))
      or ((select app_private.current_app_role()) = 'loja' and l.owner_scope = (select app_private.current_store_key()))
    )
))
with check (exists (
  select 1 from public.purchase_lists l
  where l.id = purchase_list_items.list_id
    and (
      ((select app_private.current_app_role()) in ('admin', 'comprador') and l.owner_scope = 'central')
      or ((select app_private.current_app_role()) = 'compras_internas' and l.owner_scope in ('iconha', 'reta'))
      or ((select app_private.current_app_role()) = 'loja' and l.owner_scope = (select app_private.current_store_key()))
    )
));

drop policy if exists purchase_v2_orders_read on public.purchase_v2_orders;
create policy purchase_v2_orders_read on public.purchase_v2_orders for select to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas'));
drop policy if exists purchase_v2_orders_insert on public.purchase_v2_orders;
create policy purchase_v2_orders_insert on public.purchase_v2_orders for insert to authenticated
with check (
  ((select app_private.current_app_role()) in ('admin', 'comprador') and status = 'pending')
  or ((select app_private.current_app_role()) = 'compras_internas' and status = 'completed' and supplier_name = 'LOJA PETVILLE')
);
drop policy if exists purchase_v2_orders_update on public.purchase_v2_orders;
create policy purchase_v2_orders_update on public.purchase_v2_orders for update to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas'))
with check (
  (select app_private.current_app_role()) = 'admin'
  or ((select app_private.current_app_role()) = 'comprador' and status in ('pending', 'received'))
  or ((select app_private.current_app_role()) = 'compras_internas' and status = 'completed' and supplier_name = 'LOJA PETVILLE')
);

drop policy if exists purchase_v2_order_items_read on public.purchase_v2_order_items;
create policy purchase_v2_order_items_read on public.purchase_v2_order_items for select to authenticated
using (exists (
  select 1 from public.purchase_v2_orders o
  where o.id = purchase_v2_order_items.order_id
    and (select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas')
));
drop policy if exists purchase_v2_order_items_write on public.purchase_v2_order_items;
create policy purchase_v2_order_items_write on public.purchase_v2_order_items for all to authenticated
using (exists (
  select 1 from public.purchase_v2_orders o
  where o.id = purchase_v2_order_items.order_id
    and (
      (select app_private.current_app_role()) = 'admin'
      or ((select app_private.current_app_role()) = 'comprador' and o.source_store_key is null)
      or ((select app_private.current_app_role()) = 'compras_internas'
          and o.source_store_key is not null
          and o.status = 'completed'
          and o.supplier_name = 'LOJA PETVILLE')
    )
))
with check (exists (
  select 1 from public.purchase_v2_orders o
  where o.id = purchase_v2_order_items.order_id
    and (
      (select app_private.current_app_role()) = 'admin'
      or ((select app_private.current_app_role()) = 'comprador' and o.source_store_key is null)
      or ((select app_private.current_app_role()) = 'compras_internas'
          and o.source_store_key is not null
          and o.status = 'completed'
          and o.supplier_name = 'LOJA PETVILLE')
    )
));

drop policy if exists purchase_receipts_read on public.purchase_receipts;
create policy purchase_receipts_read on public.purchase_receipts for select to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas'));
drop policy if exists purchase_receipts_write on public.purchase_receipts;
create policy purchase_receipts_write on public.purchase_receipts for all to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador'))
with check ((select app_private.current_app_role()) in ('admin', 'comprador'));

drop policy if exists purchase_receipt_items_read on public.purchase_receipt_items;
create policy purchase_receipt_items_read on public.purchase_receipt_items for select to authenticated
using (exists (
  select 1 from public.purchase_receipts r
  where r.id = purchase_receipt_items.receipt_id
    and (select app_private.current_app_role()) in ('admin', 'comprador', 'compras_internas')
));
drop policy if exists purchase_receipt_items_write on public.purchase_receipt_items;
create policy purchase_receipt_items_write on public.purchase_receipt_items for all to authenticated
using ((select app_private.current_app_role()) in ('admin', 'comprador'))
with check ((select app_private.current_app_role()) in ('admin', 'comprador'));

drop policy if exists purchase_audit_admin_read on public.purchase_audit_log;
create policy purchase_audit_admin_read on public.purchase_audit_log for select to authenticated
using ((select app_private.current_app_role()) = 'admin');
drop policy if exists purchase_audit_actor_insert on public.purchase_audit_log;
create policy purchase_audit_actor_insert on public.purchase_audit_log for insert to authenticated
with check (actor_user_id = (select auth.uid()) and (select app_private.current_app_role()) is not null);

revoke all on table
  public.app_profiles,
  public.purchase_products,
  public.purchase_sales,
  public.purchase_suppliers,
  public.purchase_settings,
  public.purchase_quotations,
  public.purchase_lists,
  public.purchase_list_items,
  public.purchase_v2_orders,
  public.purchase_v2_order_items,
  public.purchase_price_history,
  public.purchase_receipts,
  public.purchase_receipt_items,
  public.purchase_audit_log
from public, anon;

grant select, insert, update, delete on table
  public.app_profiles,
  public.purchase_products,
  public.purchase_sales,
  public.purchase_suppliers,
  public.purchase_settings,
  public.purchase_quotations,
  public.purchase_lists,
  public.purchase_list_items,
  public.purchase_v2_orders,
  public.purchase_v2_order_items,
  public.purchase_price_history,
  public.purchase_receipts,
  public.purchase_receipt_items
to authenticated;
grant select, insert on table public.purchase_audit_log to authenticated;
grant usage, select on sequence
  public.purchase_products_id_seq,
  public.purchase_sales_id_seq,
  public.purchase_suppliers_id_seq,
  public.purchase_quotations_id_seq,
  public.purchase_lists_id_seq,
  public.purchase_list_items_id_seq,
  public.purchase_v2_orders_id_seq,
  public.purchase_v2_order_items_id_seq,
  public.purchase_price_history_id_seq,
  public.purchase_receipts_id_seq,
  public.purchase_receipt_items_id_seq,
  public.purchase_audit_log_id_seq
to authenticated;

create or replace function public.get_purchase_catalog(
  p_after_id bigint default null,
  p_limit integer default 100,
  p_search text default null,
  p_include_archived boolean default false,
  p_sales_year smallint default extract(year from current_date)::smallint
)
returns table (
  id bigint,
  code text,
  name text,
  cost_price numeric,
  sale_price numeric,
  active boolean,
  monthly_sales numeric[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  caller_role := app_private.current_app_role();
  if caller_role is null then
    raise exception 'Perfil inativo ou inexistente' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.code,
    p.name,
    case when caller_role = 'loja' then null else p.cost_price end,
    case when caller_role = 'loja' then null else p.sale_price end,
    p.active,
    case when caller_role = 'loja' then null else array(
      select coalesce(s.quantity, 0)::numeric
      from generate_series(1, 12) month_number
      left join public.purchase_sales s
        on s.product_id = p.id
       and s.sale_year = p_sales_year
       and s.sale_month = month_number
      order by month_number
    ) end
  from public.purchase_products p
  where (p_after_id is null or p.id > p_after_id)
    and (p.active is true or (caller_role = 'admin' and p_include_archived is true))
    and (
      p_search is null or btrim(p_search) = ''
      or p.code ilike '%' || p_search || '%'
      or p.name ilike '%' || p_search || '%'
    )
  order by p.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function public.get_purchase_catalog(bigint, integer, text, boolean, smallint)
  from public, anon;
grant execute on function public.get_purchase_catalog(bigint, integer, text, boolean, smallint)
  to authenticated;

insert into public.purchase_lists (owner_scope, status)
values ('central', 'open'), ('iconha', 'open'), ('reta', 'open')
on conflict do nothing;

insert into public.purchase_settings (id)
values ('main')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
