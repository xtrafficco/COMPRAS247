create schema if not exists app_private;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create or replace function app_private.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.app_profiles p
  where p.auth_user_id = auth.uid()
    and p.active is true
  limit 1
$$;

create or replace function app_private.current_store_key()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.store_key
  from public.app_profiles p
  where p.auth_user_id = auth.uid()
    and p.active is true
  limit 1
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = app_private, public, pg_temp
as $$ select app_private.current_app_role() = 'admin' $$;

create or replace function app_private.is_buyer()
returns boolean
language sql
stable
security definer
set search_path = app_private, public, pg_temp
as $$ select app_private.current_app_role() = 'comprador' $$;

create or replace function app_private.is_store()
returns boolean
language sql
stable
security definer
set search_path = app_private, public, pg_temp
as $$ select app_private.current_app_role() = 'loja' $$;

create or replace function app_private.is_internal_purchasing()
returns boolean
language sql
stable
security definer
set search_path = app_private, public, pg_temp
as $$ select app_private.current_app_role() = 'compras_internas' $$;

create or replace function app_private.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = app_private, public, pg_temp
as $$ select app_private.current_app_role() is not null $$;

revoke all on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated;

alter policy app_profiles_select on public.app_profiles using (app_private.is_admin() or auth_user_id = auth.uid());
alter policy app_profiles_admin_all on public.app_profiles using (app_private.is_admin()) with check (app_private.is_admin());

alter policy produtos_select_app on public.produtos using (app_private.is_app_user());
alter policy produtos_admin_all on public.produtos using (app_private.is_admin()) with check (app_private.is_admin());
alter policy products_select_app on public.products using (app_private.is_app_user());
alter policy products_admin_all on public.products using (app_private.is_admin()) with check (app_private.is_admin());

alter policy vendas_mensais_select_app on public.vendas_mensais using (app_private.is_app_user());
alter policy vendas_mensais_admin_all on public.vendas_mensais using (app_private.is_admin()) with check (app_private.is_admin());
alter policy monthly_sales_select_app on public.monthly_sales using (app_private.is_app_user());
alter policy monthly_sales_admin_all on public.monthly_sales using (app_private.is_admin()) with check (app_private.is_admin());
alter policy historico_precos_admin_all on public.historico_precos using (app_private.is_admin()) with check (app_private.is_admin());

alter policy fornecedores_select_app on public.fornecedores using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy fornecedores_admin_all on public.fornecedores using (app_private.is_admin()) with check (app_private.is_admin());
alter policy suppliers_select_app on public.suppliers using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy suppliers_admin_all on public.suppliers using (app_private.is_admin()) with check (app_private.is_admin());

alter policy lista_pedido_select_app on public.lista_pedido using (app_private.is_app_user());
alter policy lista_pedido_write_app on public.lista_pedido using (app_private.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas')) with check (app_private.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas'));
alter policy shopping_lists_select_app on public.shopping_lists using (app_private.is_app_user());
alter policy shopping_lists_write_app on public.shopping_lists using (app_private.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas')) with check (app_private.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas'));
alter policy shopping_list_items_select_app on public.shopping_list_items using (app_private.is_app_user());
alter policy shopping_list_items_write_app on public.shopping_list_items using (app_private.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas')) with check (app_private.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas'));

alter policy pedidos_select_app on public.pedidos using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy pedidos_write_app on public.pedidos using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas')) with check (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy pedido_itens_select_app on public.pedido_itens using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy pedido_itens_write_app on public.pedido_itens using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas')) with check (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy purchase_orders_select_app on public.purchase_orders using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy purchase_orders_write_app on public.purchase_orders using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas')) with check (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy purchase_order_items_select_app on public.purchase_order_items using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy purchase_order_items_write_app on public.purchase_order_items using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas')) with check (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));

alter policy order_approvals_select_app on public.order_approvals using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy order_approvals_admin_all on public.order_approvals using (app_private.is_admin()) with check (app_private.is_admin());
alter policy received_items_select_app on public.received_items using (app_private.current_app_role() in ('admin', 'comprador', 'compras_internas'));
alter policy received_items_write_app on public.received_items using (app_private.current_app_role() in ('admin', 'comprador')) with check (app_private.current_app_role() in ('admin', 'comprador'));

alter policy usuarios_admin_all on public.usuarios using (app_private.is_admin()) with check (app_private.is_admin());
alter policy users_admin_all on public.users using (app_private.is_admin()) with check (app_private.is_admin());

revoke execute on function public.current_app_role() from public, anon, authenticated;
revoke execute on function public.current_store_key() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.is_buyer() from public, anon, authenticated;
revoke execute on function public.is_store() from public, anon, authenticated;
revoke execute on function public.is_internal_purchasing() from public, anon, authenticated;
revoke execute on function public.is_app_user() from public, anon, authenticated;

drop function if exists public.current_app_role();
drop function if exists public.current_store_key();
drop function if exists public.is_admin();
drop function if exists public.is_buyer();
drop function if exists public.is_store();
drop function if exists public.is_internal_purchasing();
drop function if exists public.is_app_user();

alter function public.aplicar_estoque_na_aprovacao() set search_path = public, pg_temp;
alter function public.aplicar_estoque_no_recebimento() set search_path = public, pg_temp;
alter function public.historico_precos_on_insert() set search_path = public, pg_temp;
alter function public.limpar_lista_apos_decisao() set search_path = public, pg_temp;
alter function public.recalcular_status_recebimento() set search_path = public, pg_temp;
alter function public.registrar_historico_precos() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
