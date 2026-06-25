-- Controle "ao vivo" das apresentações (override manual da equipe).
-- O quiosque/mapa segue o relógio por padrão (modo 'auto'); em caso de atraso a
-- equipe usa o painel (/mapa/painel) para fixar a apresentação que está no palco.

create table if not exists public.ao_vivo (
  id smallint primary key default 1,
  modo text not null default 'auto' check (modo in ('auto', 'manual')),
  -- 'hora' = a hora da apresentação no palco quando modo='manual' (ex.: '14h30').
  -- null com modo='manual' = intervalo (ninguém no palco).
  hora text,
  atualizado_em timestamptz not null default now(),
  constraint ao_vivo_singleton check (id = 1)
);

-- linha única (id = 1)
insert into public.ao_vivo (id, modo, hora) values (1, 'auto', null)
  on conflict (id) do nothing;

alter table public.ao_vivo enable row level security;

-- leitura pública (quiosques e visitantes do mapa)
drop policy if exists "ao_vivo_select_public" on public.ao_vivo;
create policy "ao_vivo_select_public" on public.ao_vivo
  for select using (true);

-- escrita apenas para usuários autenticados (equipe/admin pelo painel)
drop policy if exists "ao_vivo_update_auth" on public.ao_vivo;
create policy "ao_vivo_update_auth" on public.ao_vivo
  for update to authenticated using (true) with check (true);

-- realtime: o mapa recebe a troca de "ao vivo" na hora (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ao_vivo'
  ) then
    alter publication supabase_realtime add table public.ao_vivo;
  end if;
end $$;
