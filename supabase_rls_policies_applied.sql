-- Sistema de Compras - politicas RLS aplicadas ao schema existente no Supabase
-- Remove politicas publicas amplas e troca por acesso autenticado via public.app_profiles.

create table if not exists public.app_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'comprador', 'loja', 'compras_internas')),
  display_name text not null,
  store_key text check (store_key in ('iconha', 'reta') or store_key is null),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.app_profiles enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_profiles
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
  from public.app_profiles
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
as $$ select public.current_app_role() = 'admin' $$;

create or replace function public.is_buyer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.current_app_role() = 'comprador' $$;

create or replace function public.is_store()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.current_app_role() = 'loja' $$;

create or replace function public.is_internal_purchasing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.current_app_role() = 'compras_internas' $$;

create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.current_app_role() is not null $$;

-- Remove politicas publicas amplas existentes.
drop policy if exists acesso_publico_fornecedores on public.fornecedores;
drop policy if exists acesso_publico_produtos on public.produtos;
drop policy if exists acesso_publico_historico_precos on public.historico_precos;
drop policy if exists acesso_publico_pedidos on public.pedidos;
drop policy if exists acesso_publico_pedido_itens on public.pedido_itens;
drop policy if exists acesso_publico_usuarios on public.usuarios;
drop policy if exists acesso_publico_vendas_mensais on public.vendas_mensais;
drop policy if exists acesso_publico_lista_pedido on public.lista_pedido;
drop policy if exists acesso_publico_users on public.users;
drop policy if exists acesso_publico_products on public.products;
drop policy if exists acesso_publico_suppliers on public.suppliers;
drop policy if exists acesso_publico_monthly_sales on public.monthly_sales;
drop policy if exists acesso_publico_shopping_lists on public.shopping_lists;
drop policy if exists acesso_publico_shopping_list_items on public.shopping_list_items;
drop policy if exists acesso_publico_purchase_orders on public.purchase_orders;
drop policy if exists acesso_publico_purchase_order_items on public.purchase_order_items;
drop policy if exists acesso_publico_order_approvals on public.order_approvals;
drop policy if exists acesso_publico_received_items on public.received_items;

-- Sem acesso anonimo direto.
revoke all on table
  public.app_profiles,
  public.fornecedores,
  public.produtos,
  public.historico_precos,
  public.pedidos,
  public.pedido_itens,
  public.usuarios,
  public.vendas_mensais,
  public.lista_pedido,
  public.users,
  public.products,
  public.suppliers,
  public.monthly_sales,
  public.shopping_lists,
  public.shopping_list_items,
  public.purchase_orders,
  public.purchase_order_items,
  public.order_approvals,
  public.received_items
from anon;

grant select, insert, update, delete on table
  public.app_profiles,
  public.fornecedores,
  public.produtos,
  public.historico_precos,
  public.pedidos,
  public.pedido_itens,
  public.usuarios,
  public.vendas_mensais,
  public.lista_pedido,
  public.users,
  public.products,
  public.suppliers,
  public.monthly_sales,
  public.shopping_lists,
  public.shopping_list_items,
  public.purchase_orders,
  public.purchase_order_items,
  public.order_approvals,
  public.received_items
to authenticated;

grant usage, select on all sequences in schema public to authenticated;
grant execute on function
  public.current_app_role(),
  public.current_store_key(),
  public.is_admin(),
  public.is_buyer(),
  public.is_store(),
  public.is_internal_purchasing(),
  public.is_app_user()
to authenticated;

drop policy if exists app_profiles_select on public.app_profiles;
create policy app_profiles_select
on public.app_profiles for select
to authenticated
using (public.is_admin() or auth_user_id = auth.uid());

drop policy if exists app_profiles_admin_all on public.app_profiles;
create policy app_profiles_admin_all
on public.app_profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Leitura de catalogo e indicadores para todos os usuarios do app; escrita somente admin.
drop policy if exists produtos_select_app on public.produtos;
create policy produtos_select_app on public.produtos for select to authenticated using (public.is_app_user());
drop policy if exists produtos_admin_all on public.produtos;
create policy produtos_admin_all on public.produtos for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists products_select_app on public.products;
create policy products_select_app on public.products for select to authenticated using (public.is_app_user());
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists vendas_mensais_select_app on public.vendas_mensais;
create policy vendas_mensais_select_app on public.vendas_mensais for select to authenticated using (public.is_app_user());
drop policy if exists vendas_mensais_admin_all on public.vendas_mensais;
create policy vendas_mensais_admin_all on public.vendas_mensais for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists monthly_sales_select_app on public.monthly_sales;
create policy monthly_sales_select_app on public.monthly_sales for select to authenticated using (public.is_app_user());
drop policy if exists monthly_sales_admin_all on public.monthly_sales;
create policy monthly_sales_admin_all on public.monthly_sales for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists historico_precos_admin_all on public.historico_precos;
create policy historico_precos_admin_all on public.historico_precos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Fornecedores: leitura por admin/comprador/compras internas; escrita admin.
drop policy if exists fornecedores_select_app on public.fornecedores;
create policy fornecedores_select_app on public.fornecedores for select to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));
drop policy if exists fornecedores_admin_all on public.fornecedores;
create policy fornecedores_admin_all on public.fornecedores for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists suppliers_select_app on public.suppliers;
create policy suppliers_select_app on public.suppliers for select to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));
drop policy if exists suppliers_admin_all on public.suppliers;
create policy suppliers_admin_all on public.suppliers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Listas: lojas podem gravar listas; compras internas, comprador e admin podem consultar/processar.
drop policy if exists lista_pedido_select_app on public.lista_pedido;
create policy lista_pedido_select_app on public.lista_pedido for select to authenticated using (public.is_app_user());
drop policy if exists lista_pedido_write_app on public.lista_pedido;
create policy lista_pedido_write_app on public.lista_pedido for all to authenticated using (public.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas')) with check (public.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas'));

drop policy if exists shopping_lists_select_app on public.shopping_lists;
create policy shopping_lists_select_app on public.shopping_lists for select to authenticated using (public.is_app_user());
drop policy if exists shopping_lists_write_app on public.shopping_lists;
create policy shopping_lists_write_app on public.shopping_lists for all to authenticated using (public.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas')) with check (public.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas'));

drop policy if exists shopping_list_items_select_app on public.shopping_list_items;
create policy shopping_list_items_select_app on public.shopping_list_items for select to authenticated using (public.is_app_user());
drop policy if exists shopping_list_items_write_app on public.shopping_list_items;
create policy shopping_list_items_write_app on public.shopping_list_items for all to authenticated using (public.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas')) with check (public.current_app_role() in ('admin', 'comprador', 'loja', 'compras_internas'));

-- Pedidos: admin/comprador/compras internas leem e escrevem; lojas podem apenas consultar pedidos ligados ao fluxo futuro.
drop policy if exists pedidos_select_app on public.pedidos;
create policy pedidos_select_app on public.pedidos for select to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));
drop policy if exists pedidos_write_app on public.pedidos;
create policy pedidos_write_app on public.pedidos for all to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas')) with check (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));

drop policy if exists pedido_itens_select_app on public.pedido_itens;
create policy pedido_itens_select_app on public.pedido_itens for select to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));
drop policy if exists pedido_itens_write_app on public.pedido_itens;
create policy pedido_itens_write_app on public.pedido_itens for all to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas')) with check (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));

drop policy if exists purchase_orders_select_app on public.purchase_orders;
create policy purchase_orders_select_app on public.purchase_orders for select to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));
drop policy if exists purchase_orders_write_app on public.purchase_orders;
create policy purchase_orders_write_app on public.purchase_orders for all to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas')) with check (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));

drop policy if exists purchase_order_items_select_app on public.purchase_order_items;
create policy purchase_order_items_select_app on public.purchase_order_items for select to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));
drop policy if exists purchase_order_items_write_app on public.purchase_order_items;
create policy purchase_order_items_write_app on public.purchase_order_items for all to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas')) with check (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));

drop policy if exists order_approvals_select_app on public.order_approvals;
create policy order_approvals_select_app on public.order_approvals for select to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));
drop policy if exists order_approvals_admin_all on public.order_approvals;
create policy order_approvals_admin_all on public.order_approvals for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists received_items_select_app on public.received_items;
create policy received_items_select_app on public.received_items for select to authenticated using (public.current_app_role() in ('admin', 'comprador', 'compras_internas'));
drop policy if exists received_items_write_app on public.received_items;
create policy received_items_write_app on public.received_items for all to authenticated using (public.current_app_role() in ('admin', 'comprador')) with check (public.current_app_role() in ('admin', 'comprador'));

-- Tabelas de usuarios legadas: admin gerencia, usuario autenticado le apenas perfis basicos via app_profiles.
drop policy if exists usuarios_admin_all on public.usuarios;
create policy usuarios_admin_all on public.usuarios for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.app_profiles (role, display_name, store_key)
values
  ('admin', 'Admin', null),
  ('comprador', 'Comprador', null),
  ('loja', 'LOJA ICONHA', 'iconha'),
  ('loja', 'LOJA RETA', 'reta'),
  ('compras_internas', 'Compras internas', null)
on conflict do nothing;
