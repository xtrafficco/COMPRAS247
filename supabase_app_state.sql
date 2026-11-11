-- public.app_state: estado completo do aplicativo em JSON.
-- E a unica tabela que o app.js le e grava alem de app_profiles.
-- Execute depois de supabase_purchase_v2.sql.

create table if not exists public.app_state (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.app_state enable row level security;

-- Todo usuario com perfil ativo le e grava a linha 'main' (o app salva o estado
-- inteiro a cada alteracao). Somente admin cria ou remove a linha.
drop policy if exists app_state_read_app_users on public.app_state;
create policy app_state_read_app_users on public.app_state for select to authenticated
using ((select app_private.current_app_role()) is not null);

drop policy if exists app_state_update_app_users on public.app_state;
create policy app_state_update_app_users on public.app_state for update to authenticated
using ((select app_private.current_app_role()) is not null)
with check ((select app_private.current_app_role()) is not null);

drop policy if exists app_state_admin_insert on public.app_state;
create policy app_state_admin_insert on public.app_state for insert to authenticated
with check ((select app_private.current_app_role()) = 'admin');

drop policy if exists app_state_admin_delete on public.app_state;
create policy app_state_admin_delete on public.app_state for delete to authenticated
using ((select app_private.current_app_role()) = 'admin');

revoke all on table public.app_state from public, anon;
grant select, insert, update, delete on table public.app_state to authenticated;

create or replace function app_private.stamp_app_state_actor()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_by := (select auth.uid());
  if new.updated_at is null then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists app_state_stamp_actor on public.app_state;
create trigger app_state_stamp_actor before insert or update on public.app_state
for each row execute function app_private.stamp_app_state_actor();

insert into public.app_state (id, data) values ('main', '{}'::jsonb)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
