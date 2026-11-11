-- Migra os dados da linha public.app_state(id = 'main') para o schema purchase_*.
-- Execute depois de supabase_purchase_v2.sql e mantenha app_state como backup.

begin;

with source_products as (
  select product
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'products', '[]'::jsonb)) product
  where state_row.id = 'main'
)
insert into public.purchase_products (
  legacy_id, code, name, cost_price, sale_price, active, archived_at
)
select
  case when product->>'id' ~ '^\d+$' then (product->>'id')::bigint end,
  coalesce(nullif(btrim(product->>'code'), ''), 'P' || lpad(coalesce(product->>'id', '0'), 4, '0')),
  btrim(product->>'name'),
  greatest(0, coalesce(nullif(product->>'price', '')::numeric, 0)),
  greatest(0, coalesce(nullif(product->>'salePrice', '')::numeric, 0)),
  coalesce((product->>'active')::boolean, true),
  app_private.parse_legacy_timestamptz(product->>'archivedAt')
from source_products
where coalesce(btrim(product->>'name'), '') <> ''
on conflict do nothing;

with source_products as (
  select product
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'products', '[]'::jsonb)) product
  where state_row.id = 'main'
)
update public.purchase_products target
set legacy_id = coalesce(
  target.legacy_id,
  case when source.product->>'id' ~ '^\d+$' then (source.product->>'id')::bigint end
)
from source_products source
where source.product->>'id' ~ '^\d+$'
  and (
    lower(target.code) = lower(source.product->>'code')
    or lower(target.name) = lower(source.product->>'name')
  )
  and target.legacy_id is null;

with source_products as (
  select product
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'products', '[]'::jsonb)) product
  where state_row.id = 'main'
), yearly_sales as (
  select
    product,
    year_entry.key::smallint as sale_year,
    month_value.value,
    month_value.ordinality::smallint as sale_month
  from source_products
  cross join lateral jsonb_each(
    case
      when jsonb_typeof(product->'salesByYear') = 'object' then product->'salesByYear'
      else '{}'::jsonb
    end
  ) year_entry
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(year_entry.value) = 'array' then year_entry.value else '[]'::jsonb end
  ) with ordinality month_value(value, ordinality)
  where year_entry.key ~ '^\d{4}$'
    and year_entry.key::integer between 2000 and 2100
    and month_value.ordinality between 1 and 12
)
insert into public.purchase_sales (product_id, sale_year, sale_month, quantity)
select
  target.id,
  source.sale_year,
  source.sale_month,
  greatest(0, coalesce(nullif(source.value, '')::numeric, 0))
from yearly_sales source
join public.purchase_products target
  on target.legacy_id = case
    when source.product->>'id' ~ '^\d+$' then (source.product->>'id')::bigint
  end
on conflict (product_id, sale_year, sale_month)
do update set quantity = excluded.quantity, imported_at = now();

with legacy_sales as (
  select
    product,
    coalesce(nullif(state_row.data->>'salesYear', '')::smallint, extract(year from current_date)::smallint) as sale_year,
    month_value.value,
    month_value.ordinality::smallint as sale_month
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'products', '[]'::jsonb)) product
  cross join lateral jsonb_array_elements_text(coalesce(product->'sales', '[]'::jsonb)) with ordinality month_value(value, ordinality)
  where state_row.id = 'main'
    and case
      when jsonb_typeof(product->'salesByYear') = 'object'
        then jsonb_object_length(product->'salesByYear') = 0
      else true
    end
    and month_value.ordinality between 1 and 12
)
insert into public.purchase_sales (product_id, sale_year, sale_month, quantity)
select
  target.id,
  source.sale_year,
  source.sale_month,
  greatest(0, coalesce(nullif(source.value, '')::numeric, 0))
from legacy_sales source
join public.purchase_products target
  on target.legacy_id = case
    when source.product->>'id' ~ '^\d+$' then (source.product->>'id')::bigint
  end
on conflict (product_id, sale_year, sale_month)
do update set quantity = excluded.quantity, imported_at = now();

with source_suppliers as (
  select supplier
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'suppliers', '[]'::jsonb)) supplier
  where state_row.id = 'main'
)
insert into public.purchase_suppliers (
  legacy_id, name, contact, phone, default_terms, notes, active
)
select
  case when supplier->>'id' ~ '^\d+$' then (supplier->>'id')::bigint end,
  btrim(supplier->>'name'),
  nullif(btrim(supplier->>'contact'), ''),
  nullif(btrim(supplier->>'phone'), ''),
  nullif(btrim(supplier->>'terms'), ''),
  nullif(btrim(supplier->>'notes'), ''),
  true
from source_suppliers
where coalesce(btrim(supplier->>'name'), '') <> ''
on conflict do nothing;

with source_suppliers as (
  select supplier
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'suppliers', '[]'::jsonb)) supplier
  where state_row.id = 'main'
)
update public.purchase_suppliers target
set legacy_id = coalesce(
  target.legacy_id,
  case when source.supplier->>'id' ~ '^\d+$' then (source.supplier->>'id')::bigint end
)
from source_suppliers source
where source.supplier->>'id' ~ '^\d+$'
  and lower(target.name) = lower(source.supplier->>'name')
  and target.legacy_id is null;

insert into public.purchase_settings (id, auto_approval_limit, price_increase_alert_percent)
select
  'main',
  greatest(0, coalesce(nullif(state_row.data->'settings'->>'autoApprovalLimit', '')::numeric, 0)),
  greatest(0, coalesce(nullif(state_row.data->'settings'->>'priceIncreaseAlertPercent', '')::numeric, 10))
from public.app_state state_row
where state_row.id = 'main'
on conflict (id) do update
set
  auto_approval_limit = excluded.auto_approval_limit,
  price_increase_alert_percent = excluded.price_increase_alert_percent;

with source_quotations as (
  select quotation
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'quotations', '[]'::jsonb)) quotation
  where state_row.id = 'main'
)
insert into public.purchase_quotations (
  product_id, supplier_id, price, delivery_days, notes, quoted_at
)
select
  product_row.id,
  supplier_row.id,
  greatest(0.01, coalesce(nullif(source.quotation->>'price', '')::numeric, 0.01)),
  greatest(0, coalesce(nullif(source.quotation->>'deliveryDays', '')::integer, 0)),
  nullif(source.quotation->>'notes', ''),
  coalesce(app_private.parse_legacy_timestamptz(source.quotation->>'quotedAt'), now())
from source_quotations source
join public.purchase_products product_row
  on product_row.legacy_id = case when source.quotation->>'productId' ~ '^\d+$' then (source.quotation->>'productId')::bigint end
join public.purchase_suppliers supplier_row
  on supplier_row.legacy_id = case when source.quotation->>'supplierId' ~ '^\d+$' then (source.quotation->>'supplierId')::bigint end
on conflict (product_id, supplier_id) do update
set
  price = excluded.price,
  delivery_days = excluded.delivery_days,
  notes = excluded.notes,
  quoted_at = excluded.quoted_at;

insert into public.purchase_lists (owner_scope, status)
values ('central', 'open'), ('iconha', 'open'), ('reta', 'open')
on conflict do nothing;

with central_items as (
  select item
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'list', '[]'::jsonb)) item
  where state_row.id = 'main'
)
insert into public.purchase_list_items (list_id, product_id, quantity)
select
  list_row.id,
  product_row.id,
  greatest(1, coalesce(nullif(item->>'qty', '')::numeric, 1))
from central_items
join public.purchase_products product_row
  on product_row.legacy_id = case
    when item->>'productId' ~ '^\d+$' then (item->>'productId')::bigint
  end
join public.purchase_lists list_row
  on list_row.owner_scope = 'central' and list_row.status = 'open'
on conflict (list_id, product_id)
do update set quantity = excluded.quantity, updated_at = now();

with store_items as (
  select store_entry.key as store_key, item
  from public.app_state state_row
  cross join lateral jsonb_each(coalesce(state_row.data->'storeLists', '{}'::jsonb)) store_entry
  cross join lateral jsonb_array_elements(coalesce(store_entry.value, '[]'::jsonb)) item
  where state_row.id = 'main'
    and store_entry.key in ('iconha', 'reta')
)
insert into public.purchase_list_items (list_id, product_id, quantity)
select
  list_row.id,
  product_row.id,
  greatest(1, coalesce(nullif(item->>'qty', '')::numeric, 1))
from store_items
join public.purchase_products product_row
  on product_row.legacy_id = case
    when item->>'productId' ~ '^\d+$' then (item->>'productId')::bigint
  end
join public.purchase_lists list_row
  on list_row.owner_scope = store_items.store_key and list_row.status = 'open'
on conflict (list_id, product_id)
do update set quantity = excluded.quantity, updated_at = now();

with source_orders as (
  select order_data
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'orders', '[]'::jsonb)) order_data
  where state_row.id = 'main'
)
insert into public.purchase_v2_orders (
  legacy_id, status, supplier_id, supplier_name, supplier_contact, supplier_phone,
  supplier_terms, buyer_name, source_store_key, priority, desired_delivery,
  installments, installment_value, notes, approval_type, decision_reason,
  total_value, created_at, approved_at,
  rejected_at, received_at, completed_at
)
select
  case when order_data->>'id' ~ '^\d+$' then (order_data->>'id')::bigint end,
  case
    when order_data->>'status' in ('pending', 'approved', 'rejected', 'received', 'completed') then order_data->>'status'
    else 'pending'
  end,
  supplier_row.id,
  coalesce(nullif(order_data->>'supplier', ''), 'Fornecedor removido'),
  nullif(order_data->>'supplierContact', ''),
  nullif(order_data->>'supplierPhone', ''),
  nullif(order_data->>'supplierTerms', ''),
  coalesce(nullif(order_data->>'buyer', ''), 'Sem solicitante'),
  case when order_data->>'sourceStore' in ('iconha', 'reta') then order_data->>'sourceStore' end,
  coalesce(nullif(order_data->>'priority', ''), 'Normal'),
  case when order_data->>'delivery' ~ '^\d{4}-\d{2}-\d{2}$' then (order_data->>'delivery')::date end,
  greatest(1, coalesce(nullif(order_data->>'installments', '')::integer, 1)),
  greatest(0, coalesce(nullif(order_data->>'installmentValue', '')::numeric, 0)),
  nullif(order_data->>'notes', ''),
  case when order_data->>'approvalType' in ('manual', 'automatic') then order_data->>'approvalType' end,
  case
    when order_data->>'status' = 'rejected' then coalesce(nullif(order_data->>'decisionReason', ''), 'Migrado sem justificativa informada')
    else nullif(order_data->>'decisionReason', '')
  end,
  coalesce((
    select sum(
      greatest(0, coalesce(nullif(item->>'qty', '')::numeric, 0)) *
      greatest(0, coalesce(nullif(item->>'unitPrice', '')::numeric, 0))
    )
    from jsonb_array_elements(coalesce(order_data->'items', '[]'::jsonb)) item
  ), 0),
  coalesce(app_private.parse_legacy_timestamptz(order_data->>'createdAt'), now()),
  app_private.parse_legacy_timestamptz(order_data->>'approvedAt'),
  app_private.parse_legacy_timestamptz(order_data->>'rejectedAt'),
  app_private.parse_legacy_timestamptz(order_data->'receiving'->>'confirmedAt'),
  app_private.parse_legacy_timestamptz(order_data->>'completedAt')
from source_orders
left join public.purchase_suppliers supplier_row
  on supplier_row.legacy_id = case when order_data->>'supplierId' ~ '^\d+$' then (order_data->>'supplierId')::bigint end
where order_data->>'id' ~ '^\d+$'
on conflict (legacy_id) do nothing;

with source_order_items as (
  select order_data, item
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'orders', '[]'::jsonb)) order_data
  cross join lateral jsonb_array_elements(coalesce(order_data->'items', '[]'::jsonb)) item
  where state_row.id = 'main'
    and order_data->>'id' ~ '^\d+$'
)
insert into public.purchase_v2_order_items (
  order_id, product_id, product_code, product_name,
  suggested_quantity, ordered_quantity, unit_price
)
select
  order_row.id,
  product_row.id,
  coalesce(nullif(item->>'productCode', ''), product_row.code, '-'),
  coalesce(nullif(item->>'productName', ''), product_row.name, 'Produto removido'),
  greatest(0, coalesce(nullif(item->>'suggestedQty', '')::numeric, 1)),
  greatest(1, coalesce(nullif(item->>'qty', '')::numeric, 1)),
  greatest(0, coalesce(nullif(item->>'unitPrice', '')::numeric, product_row.cost_price, 0))
from source_order_items
join public.purchase_v2_orders order_row
  on order_row.legacy_id = case
    when order_data->>'id' ~ '^\d+$' then (order_data->>'id')::bigint
  end
left join public.purchase_products product_row
  on product_row.legacy_id = case when item->>'productId' ~ '^\d+$' then (item->>'productId')::bigint end
where not exists (
  select 1 from public.purchase_v2_order_items existing
  where existing.order_id = order_row.id
    and existing.product_code = coalesce(nullif(item->>'productCode', ''), product_row.code, '-')
);

with source_deliveries as (
  select order_data, delivery.value as delivery, delivery.ordinality::integer as delivery_number
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'orders', '[]'::jsonb)) order_data
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(order_data->'receiving'->'deliveries') = 'array' then order_data->'receiving'->'deliveries' else '[]'::jsonb end
  ) with ordinality delivery(value, ordinality)
  where state_row.id = 'main'
    and order_data->>'id' ~ '^\d+$'
    and order_data->>'status' <> 'completed'
)
insert into public.purchase_receipts (order_id, delivery_number, confirmed_at, total_received)
select
  order_row.id,
  source.delivery_number,
  coalesce(app_private.parse_legacy_timestamptz(source.delivery->>'confirmedAt'), now()),
  0
from source_deliveries source
join public.purchase_v2_orders order_row
  on order_row.legacy_id = case when source.order_data->>'id' ~ '^\d+$' then (source.order_data->>'id')::bigint end
on conflict (order_id, delivery_number) do update
set confirmed_at = excluded.confirmed_at;

with source_delivery_items as (
  select order_data, delivery.ordinality::integer as delivery_number, received_item
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'orders', '[]'::jsonb)) order_data
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(order_data->'receiving'->'deliveries') = 'array' then order_data->'receiving'->'deliveries' else '[]'::jsonb end
  ) with ordinality delivery(value, ordinality)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(delivery.value->'items') = 'array' then delivery.value->'items' else '[]'::jsonb end
  ) received_item
  where state_row.id = 'main'
    and order_data->>'id' ~ '^\d+$'
)
insert into public.purchase_receipt_items (
  receipt_id, order_item_id, received_quantity, received_unit_price
)
select
  receipt.id,
  order_item.id,
  greatest(0, coalesce(nullif(source.received_item->>'receivedQty', '')::numeric, 0)),
  greatest(0, coalesce(nullif(source.received_item->>'receivedPrice', '')::numeric, order_item.unit_price))
from source_delivery_items source
join public.purchase_v2_orders order_row
  on order_row.legacy_id = case when source.order_data->>'id' ~ '^\d+$' then (source.order_data->>'id')::bigint end
join public.purchase_receipts receipt
  on receipt.order_id = order_row.id and receipt.delivery_number = source.delivery_number
join public.purchase_products product_row
  on product_row.legacy_id = case when source.received_item->>'productId' ~ '^\d+$' then (source.received_item->>'productId')::bigint end
join public.purchase_v2_order_items order_item
  on order_item.order_id = order_row.id and order_item.product_id = product_row.id
on conflict (receipt_id, order_item_id) do update
set
  received_quantity = excluded.received_quantity,
  received_unit_price = excluded.received_unit_price;

with legacy_receipts as (
  select order_data
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'orders', '[]'::jsonb)) order_data
  where state_row.id = 'main'
    and order_data->>'id' ~ '^\d+$'
    and coalesce(order_data->'receiving'->>'confirmedAt', '') <> ''
    and jsonb_array_length(case when jsonb_typeof(order_data->'receiving'->'deliveries') = 'array' then order_data->'receiving'->'deliveries' else '[]'::jsonb end) = 0
    and order_data->>'status' <> 'completed'
)
insert into public.purchase_receipts (order_id, delivery_number, confirmed_at, total_received)
select
  order_row.id,
  1,
  coalesce(app_private.parse_legacy_timestamptz(source.order_data->'receiving'->>'confirmedAt'), order_row.received_at, now()),
  0
from legacy_receipts source
join public.purchase_v2_orders order_row
  on order_row.legacy_id = case when source.order_data->>'id' ~ '^\d+$' then (source.order_data->>'id')::bigint end
on conflict (order_id, delivery_number) do nothing;

insert into public.purchase_receipt_items (
  receipt_id, order_item_id, received_quantity, received_unit_price
)
select
  receipt.id,
  item.id,
  coalesce(nullif(received.value->>'receivedQty', '')::numeric, item.ordered_quantity),
  coalesce(nullif(received.value->>'receivedPrice', '')::numeric, item.unit_price)
from public.app_state state_row
cross join lateral jsonb_array_elements(coalesce(state_row.data->'orders', '[]'::jsonb)) order_data
join public.purchase_v2_orders order_row
  on order_row.legacy_id = case when order_data->>'id' ~ '^\d+$' then (order_data->>'id')::bigint end
join public.purchase_receipts receipt on receipt.order_id = order_row.id and receipt.delivery_number = 1
cross join lateral jsonb_each(coalesce(order_data->'receiving'->'items', '{}'::jsonb)) received
join public.purchase_products product_row
  on product_row.legacy_id = case when received.key ~ '^\d+$' then received.key::bigint end
join public.purchase_v2_order_items item
  on item.order_id = order_row.id and item.product_id = product_row.id
where state_row.id = 'main'
  and received.key ~ '^\d+$'
  and jsonb_array_length(case when jsonb_typeof(order_data->'receiving'->'deliveries') = 'array' then order_data->'receiving'->'deliveries' else '[]'::jsonb end) = 0
on conflict (receipt_id, order_item_id) do update set
  received_quantity = excluded.received_quantity,
  received_unit_price = excluded.received_unit_price;

with source_price_history as (
  select entry
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'priceHistory', '[]'::jsonb)) entry
  where state_row.id = 'main'
)
insert into public.purchase_price_history (
  legacy_id, product_id, cost_price, sale_price, source, source_order_id,
  recorded_by_name, recorded_at
)
select
  case when source.entry->>'id' ~ '^\d+$' then (source.entry->>'id')::bigint end,
  product_row.id,
  greatest(0, coalesce(nullif(source.entry->>'costPrice', '')::numeric, 0)),
  greatest(0, coalesce(nullif(source.entry->>'salePrice', '')::numeric, 0)),
  coalesce(nullif(source.entry->>'source', ''), 'Registro migrado'),
  order_row.id,
  coalesce(nullif(source.entry->>'changedBy', ''), 'Sistema'),
  coalesce(app_private.parse_legacy_timestamptz(source.entry->>'changedAt'), now())
from source_price_history source
join public.purchase_products product_row
  on product_row.legacy_id = case
    when source.entry->>'productId' ~ '^\d+$' then (source.entry->>'productId')::bigint
  end
left join public.purchase_v2_orders order_row
  on order_row.legacy_id = case
    when source.entry->>'sourceOrderId' ~ '^\d+$' then (source.entry->>'sourceOrderId')::bigint
  end
where source.entry->>'id' ~ '^\d+$'
on conflict (legacy_id) do update
set
  product_id = excluded.product_id,
  cost_price = excluded.cost_price,
  sale_price = excluded.sale_price,
  source = excluded.source,
  source_order_id = excluded.source_order_id,
  recorded_by_name = excluded.recorded_by_name,
  recorded_at = excluded.recorded_at;

insert into public.purchase_price_history (
  product_id, cost_price, sale_price, source, recorded_by_name
)
select
  product_row.id,
  product_row.cost_price,
  product_row.sale_price,
  'Cadastro inicial',
  'Sistema'
from public.purchase_products product_row
where not exists (
  select 1 from public.purchase_price_history history
  where history.product_id = product_row.id
);

with source_audit as (
  select entry
  from public.app_state state_row
  cross join lateral jsonb_array_elements(coalesce(state_row.data->'auditLog', '[]'::jsonb)) entry
  where state_row.id = 'main'
)
insert into public.purchase_audit_log (
  actor_name, area, action, entity_id, details, created_at
)
select
  coalesce(nullif(entry->>'user', ''), 'Sistema'),
  case
    when entry->>'area' in ('catalog', 'sales', 'supplier', 'list', 'order', 'receipt', 'system') then entry->>'area'
    else 'system'
  end,
  coalesce(nullif(entry->>'action', ''), 'Evento migrado'),
  nullif(entry->>'entityId', ''),
  jsonb_build_object('details', coalesce(entry->>'details', ''), 'email', coalesce(entry->>'email', '')),
  coalesce(app_private.parse_legacy_timestamptz(entry->>'createdAt'), now())
from source_audit source
where not exists (
  select 1 from public.purchase_audit_log existing
  where existing.action = coalesce(nullif(source.entry->>'action', ''), 'Evento migrado')
    and existing.entity_id is not distinct from nullif(source.entry->>'entityId', '')
    and existing.actor_name = coalesce(nullif(source.entry->>'user', ''), 'Sistema')
);

commit;

select
  (select count(*) from public.purchase_products) as products,
  (select count(*) from public.purchase_sales) as monthly_sales,
  (select count(*) from public.purchase_suppliers) as suppliers,
  (select count(*) from public.purchase_quotations) as quotations,
  (select count(*) from public.purchase_price_history) as price_history,
  (select count(*) from public.purchase_list_items) as list_items,
  (select count(*) from public.purchase_v2_orders) as orders,
  (select count(*) from public.purchase_v2_order_items) as order_items,
  (select count(*) from public.purchase_receipts) as receipts,
  (select count(*) from public.purchase_audit_log) as audit_entries;
