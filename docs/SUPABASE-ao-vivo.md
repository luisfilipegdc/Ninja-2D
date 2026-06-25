# Supabase — Controle "Ao vivo" das apresentações

Este recurso permite que a **equipe** ajuste, em caso de **atraso**, qual apresentação
está **no palco agora** — e o mapa/quiosque atualiza o selo **AO VIVO** em tempo real
para todos os aparelhos. Os horários da programação **continuam os mesmos** (não é
preciso mexer nos dados); o controle é só um "override" por cima do relógio.

- **Sem configurar nada**, o mapa funciona no modo **automático** (segue o relógio).
- **Depois de aplicar o SQL abaixo**, o painel da equipe em **`/mapa/painel`** passa a
  funcionar e o controle manual fica disponível.

---

## 1. Aplicar o banco de dados (copiar e colar)

No painel do **Supabase** → menu **SQL Editor** → **New query** → cole o bloco abaixo e
clique em **Run**. (É idempotente: pode rodar mais de uma vez sem problema.)

```sql
-- Controle "ao vivo" das apresentações (override manual da equipe).
create table if not exists public.ao_vivo (
  id smallint primary key default 1,
  modo text not null default 'auto' check (modo in ('auto', 'manual')),
  hora text,
  atualizado_em timestamptz not null default now(),
  constraint ao_vivo_singleton check (id = 1)
);

insert into public.ao_vivo (id, modo, hora) values (1, 'auto', null)
  on conflict (id) do nothing;

alter table public.ao_vivo enable row level security;

drop policy if exists "ao_vivo_select_public" on public.ao_vivo;
create policy "ao_vivo_select_public" on public.ao_vivo
  for select using (true);

drop policy if exists "ao_vivo_update_auth" on public.ao_vivo;
create policy "ao_vivo_update_auth" on public.ao_vivo
  for update to authenticated using (true) with check (true);

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
```

> Esse mesmo SQL está versionado no repositório em
> `supabase/migrations/0015_ao_vivo.sql`.

## 2. Quem pode alterar (login)

O painel exige **login de administrador** (o mesmo usuário do `/admin`). Se ainda não
existir, crie em **Authentication → Users → Add user** (e-mail + senha, marque
**Auto Confirm**). A leitura do "ao vivo" é pública (quiosques), mas **só usuários
autenticados podem alterar** (regra de RLS acima).

## 3. Como a equipe usa no dia

Abra **`/mapa/painel`** (ex.: `https://festajuninamarista.vercel.app/mapa/painel`),
faça login e:

- **🟢 Automático (relógio)** — o padrão; o mapa segue os horários previstos sozinho.
- **Tocar numa apresentação** — fixa ela como **"no palco agora"** (use quando atrasar
  ou adiantar). Todos os mapas/quiosques mudam o selo **AO VIVO** na hora.
- **⏸ Intervalo** — marca que **ninguém** está no palco no momento.

Quando a festa voltar ao horário, é só tocar em **Automático** de novo.

## Como funciona por dentro

- Tabela `ao_vivo` (linha única, `id = 1`): `modo` (`auto`/`manual`) e `hora` (a hora da
  apresentação no palco quando manual; `null` = intervalo).
- O mapa (`useAoVivo`) lê essa linha e **assina realtime**: se `modo='manual'`, usa a
  `hora` escolhida; senão, calcula pelo relógio. Sem Supabase configurado, cai no
  relógio automaticamente (degrada com elegância).
