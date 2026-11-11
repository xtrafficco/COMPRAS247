-- Validacao somente leitura para executar depois do schema e da importacao v2.

do $$
begin
  if exists (
    select 1 from public.purchase_products
    group by lower(code) having count(*) > 1
  ) then
    raise exception 'Existem codigos de produto duplicados';
  end if;

  if exists (
    select 1 from public.purchase_products
    group by lower(name) having count(*) > 1
  ) then
    raise exception 'Existem nomes de produto duplicados';
  end if;

  if exists (
    select 1
    from public.purchase_v2_orders orders
    left join lateral (
      select coalesce(sum(items.total_value), 0) as items_total
      from public.purchase_v2_order_items items
      where items.order_id = orders.id
    ) totals on true
    where abs(orders.total_value - totals.items_total) > 0.01
  ) then
    raise exception 'Existem pedidos cujo total difere da soma dos itens';
  end if;

  if exists (
    select 1
    from public.purchase_receipts receipts
    left join lateral (
      select coalesce(sum(items.received_total_value), 0) as items_total
      from public.purchase_receipt_items items
      where items.receipt_id = receipts.id
    ) totals on true
    where abs(receipts.total_received - totals.items_total) > 0.01
  ) then
    raise exception 'Existem recebimentos cujo total difere da soma dos itens';
  end if;
end;
$$;

select
  (select count(*) from public.purchase_products) as products,
  (select count(*) from public.purchase_products where active) as active_products,
  (select count(*) from public.purchase_sales) as monthly_sales,
  (select count(distinct sale_year) from public.purchase_sales) as sales_years,
  (select count(*) from public.purchase_suppliers) as suppliers,
  (select count(*) from public.purchase_quotations) as quotations,
  (select count(*) from public.purchase_price_history) as price_history,
  (select count(*) from public.purchase_list_items) as list_items,
  (select count(*) from public.purchase_v2_orders) as orders,
  (select count(*) from public.purchase_v2_order_items) as order_items,
  (select count(*) from public.purchase_receipts) as receipts,
  (select count(*) from public.purchase_audit_log) as audit_entries;

select
  profiles.role,
  coalesce(profiles.store_key, 'central') as scope,
  count(*) as active_profiles
from public.app_profiles profiles
where profiles.active
group by profiles.role, profiles.store_key
order by profiles.role, profiles.store_key;

select
  tables.tablename,
  tables.rowsecurity,
  count(policies.policyname) as policy_count
from pg_tables tables
left join pg_policies policies
  on policies.schemaname = tables.schemaname
 and policies.tablename = tables.tablename
where tables.schemaname = 'public'
  and tables.tablename in (
    'app_profiles', 'purchase_products', 'purchase_sales', 'purchase_suppliers',
    'purchase_settings', 'purchase_quotations', 'purchase_price_history', 'purchase_lists', 'purchase_list_items', 'purchase_v2_orders',
    'purchase_v2_order_items', 'purchase_receipts', 'purchase_receipt_items',
    'purchase_audit_log'
  )
group by tables.tablename, tables.rowsecurity
order by tables.tablename;
