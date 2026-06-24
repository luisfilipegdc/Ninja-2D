-- Arraiá do Tesouro — papéis de admin (master/admin)
-- Rode no Supabase: SQL Editor → Run. (idempotente)
--
-- A criação/remoção de admins é feita pela Edge Function `admin-manage`
-- (que usa a service_role, do lado servidor). Esta tabela guarda QUEM é
-- admin e o papel. O app lê o próprio papel pra liberar as telas.
--
-- >>> Troque o e-mail abaixo se o master for outro. <<<

create table if not exists public.admins (
  email       text primary key,
  role        text not null default 'admin' check (role in ('admin','master')),
  created_at  timestamptz not null default now()
);

alter table public.admins enable row level security;

-- qualquer organizador logado pode LER os papéis (pra saber o próprio e listar)
drop policy if exists admins_select_auth on public.admins;
create policy admins_select_auth on public.admins
  for select to authenticated using (true);

-- escrita só pela service_role (Edge Function) — sem policy de insert/update/delete
grant select on public.admins to authenticated;

-- semente do master
insert into public.admins (email, role)
values ('luis.gomes@maristabrasil.org', 'master')
on conflict (email) do update set role = 'master';
