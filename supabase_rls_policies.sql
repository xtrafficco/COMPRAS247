-- Sistema de Compras - RLS e politicas iniciais
-- Estas politicas assumem login via Supabase Auth e app_users.auth_user_id preenchido.

alter table public.app_users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_users
  where auth_user_id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.current_store_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select store_key
  from public.app_users
  where auth_user_id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin'
$$;

create or replace function public.is_buyer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'comprador'
$$;

create or replace function public.is_internal_purchasing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'compras_internas'
$$;

create or replace function public.is_store()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'loja'
$$;

alter table public.app_users enable row level security;
alter table public.products enable row level security;
alter table public.product_sales enable row level security;
alter table public.suppliers enable row level security;
alter table public.store_lists enable row level security;
alter table public.store_list_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;

revoke all on table
  public.app_users,
  public.products,
  public.product_sales,
  public.suppliers,
  public.store_lists,
  public.store_list_items,
  public.purchase_orders,
  public.purchase_order_items,
  public.receipts,
  public.receipt_items
from anon;

grant select, insert, update, delete on table
  public.app_users,
  public.products,
  public.product_sales,
  public.suppliers,
  public.store_lists,
  public.store_list_items,
  public.purchase_orders,
  public.purchase_order_items,
  public.receipts,
  public.receipt_items
to authenticated;

grant usage, select on all sequences in schema public to authenticated;
grant execute on function
  public.current_app_role(),
  public.current_store_key(),
  public.is_admin(),
  public.is_buyer(),
  public.is_internal_purchasing(),
  public.is_store()
to authenticated;

drop policy if exists app_users_select_policy on public.app_users;
create policy app_users_select_policy
on public.app_users for select
to authenticated
using (public.is_admin() or auth_user_id = auth.uid());

drop policy if exists app_users_admin_write_policy on public.app_users;
create policy app_users_admin_write_policy
on public.app_users for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists products_select_policy on public.products;
create policy products_select_policy
on public.products for select
to authenticated
using (active = true and public.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas'));

drop policy if exists products_admin_write_policy on public.products;
create policy products_admin_write_policy
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists product_sales_select_policy on public.product_sales;
create policy product_sales_select_policy
on public.product_sales for select
to authenticated
using (
  public.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas')
  and exists (
    select 1 from public.products p
    where p.id = product_sales.product_id
      and p.active = true
  )
);

drop policy if exists product_sales_admin_write_policy on public.product_sales;
create policy product_sales_admin_write_policy
on public.product_sales for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists suppliers_select_policy on public.suppliers;
create policy suppliers_select_policy
on public.suppliers for select
to authenticated
using (active = true and public.current_app_role() in ('admin', 'comprador', 'compras_internas'));

drop policy if exists suppliers_admin_write_policy on public.suppliers;
create policy suppliers_admin_write_policy
on public.suppliers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists store_lists_select_policy on public.store_lists;
create policy store_lists_select_policy
on public.store_lists for select
to authenticated
using (
  public.is_admin()
  or public.is_internal_purchasing()
  or (public.is_store() and store_key = public.current_store_key())
);

drop policy if exists store_lists_write_policy on public.store_lists;
create policy store_lists_write_policy
on public.store_lists for insert
to authenticated
with check (
  public.is_admin()
  or public.is_internal_purchasing()
  or (public.is_store() and store_key = public.current_store_key())
);

drop policy if exists store_lists_update_policy on public.store_lists;
create policy store_lists_update_policy
on public.store_lists for update
to authenticated
using (
  public.is_admin()
  or public.is_internal_purchasing()
  or (public.is_store() and store_key = public.current_store_key())
)
with check (
  public.is_admin()
  or public.is_internal_purchasing()
  or (public.is_store() and store_key = public.current_store_key())
);

drop policy if exists store_list_items_select_policy on public.store_list_items;
create policy store_list_items_select_policy
on public.store_list_items for select
to authenticated
using (
  exists (
    select 1 from public.store_lists sl
    where sl.id = store_list_items.store_list_id
      and (
        public.is_admin()
        or public.is_internal_purchasing()
        or (public.is_store() and sl.store_key = public.current_store_key())
      )
  )
);

drop policy if exists store_list_items_insert_policy on public.store_list_items;
create policy store_list_items_insert_policy
on public.store_list_items for insert
to authenticated
with check (
  exists (
    select 1 from public.store_lists sl
    where sl.id = store_list_items.store_list_id
      and sl.status = 'open'
      and (
        public.is_admin()
        or public.is_internal_purchasing()
        or (public.is_store() and sl.store_key = public.current_store_key())
      )
  )
);

drop policy if exists store_list_items_update_policy on public.store_list_items;
create policy store_list_items_update_policy
on public.store_list_items for update
to authenticated
using (
  exists (
    select 1 from public.store_lists sl
    where sl.id = store_list_items.store_list_id
      and sl.status = 'open'
      and (
        public.is_admin()
        or public.is_internal_purchasing()
        or (public.is_store() and sl.store_key = public.current_store_key())
      )
  )
)
with check (
  exists (
    select 1 from public.store_lists sl
    where sl.id = store_list_items.store_list_id
      and sl.status = 'open'
      and (
        public.is_admin()
        or public.is_internal_purchasing()
        or (public.is_store() and sl.store_key = public.current_store_key())
      )
  )
);

drop policy if exists store_list_items_delete_policy on public.store_list_items;
create policy store_list_items_delete_policy
on public.store_list_items for delete
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.store_lists sl
    where sl.id = store_list_items.store_list_id
      and sl.status = 'open'
      and (
        public.is_internal_purchasing()
        or (public.is_store() and sl.store_key = public.current_store_key())
      )
  )
);

drop policy if exists purchase_orders_select_policy on public.purchase_orders;
create policy purchase_orders_select_policy
on public.purchase_orders for select
to authenticated
using (
  public.is_admin()
  or public.is_buyer()
  or public.is_internal_purchasing()
  or (public.is_store() and source_store_key = public.current_store_key())
);

drop policy if exists purchase_orders_insert_policy on public.purchase_orders;
create policy purchase_orders_insert_policy
on public.purchase_orders for insert
to authenticated
with check (
  public.is_admin()
  or public.is_buyer()
  or (
    public.is_internal_purchasing()
    and status = 'completed'
    and supplier_name = 'LOJA PETVILLE'
  )
);

drop policy if exists purchase_orders_update_policy on public.purchase_orders;
create policy purchase_orders_update_policy
on public.purchase_orders for update
to authenticated
using (public.is_admin() or public.is_buyer() or public.is_internal_purchasing())
with check (public.is_admin() or public.is_buyer() or public.is_internal_purchasing());

drop policy if exists purchase_order_items_select_policy on public.purchase_order_items;
create policy purchase_order_items_select_policy
on public.purchase_order_items for select
to authenticated
using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_items.order_id
      and (
        public.is_admin()
        or public.is_buyer()
        or public.is_internal_purchasing()
        or (public.is_store() and po.source_store_key = public.current_store_key())
      )
  )
);

drop policy if exists purchase_order_items_insert_policy on public.purchase_order_items;
create policy purchase_order_items_insert_policy
on public.purchase_order_items for insert
to authenticated
with check (
  exists (
    select 1 from public.purchase_orders po
    where po.id = purchase_order_items.order_id
      and (
        public.is_admin()
        or public.is_buyer()
        or (
          public.is_internal_purchasing()
          and po.status = 'completed'
          and po.supplier_name = 'LOJA PETVILLE'
        )
      )
  )
);

drop policy if exists purchase_order_items_update_policy on public.purchase_order_items;
create policy purchase_order_items_update_policy
on public.purchase_order_items for update
to authenticated
using (public.is_admin() or public.is_buyer() or public.is_internal_purchasing())
with check (public.is_admin() or public.is_buyer() or public.is_internal_purchasing());

drop policy if exists receipts_select_policy on public.receipts;
create policy receipts_select_policy
on public.receipts for select
to authenticated
using (
  exists (
    select 1 from public.purchase_orders po
    where po.id = receipts.order_id
      and (
        public.is_admin()
        or public.is_buyer()
        or public.is_internal_purchasing()
      )
  )
);

drop policy if exists receipts_write_policy on public.receipts;
create policy receipts_write_policy
on public.receipts for all
to authenticated
using (public.is_admin() or public.is_buyer())
with check (public.is_admin() or public.is_buyer());

drop policy if exists receipt_items_select_policy on public.receipt_items;
create policy receipt_items_select_policy
on public.receipt_items for select
to authenticated
using (
  exists (
    select 1
    from public.receipts r
    join public.purchase_orders po on po.id = r.order_id
    where r.id = receipt_items.receipt_id
      and (
        public.is_admin()
        or public.is_buyer()
        or public.is_internal_purchasing()
      )
  )
);

drop policy if exists receipt_items_write_policy on public.receipt_items;
create policy receipt_items_write_policy
on public.receipt_items for all
to authenticated
using (public.is_admin() or public.is_buyer())
with check (public.is_admin() or public.is_buyer());
