-- ============================================================
--  SCHEMA DO SUPABASE — ENTEC 2026
--  Rode este script no SQL Editor do seu projeto Supabase
--  (Dashboard -> SQL Editor -> New query -> Run).
-- ============================================================

-- Tabela de inscrições/vendas da camisa
create table if not exists public.inscricoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_camisa text, -- nome escolhido para estampar na camisa (opcional)
  telefone text not null,
  email text not null,
  tamanho text not null,
  genero text, -- masculino/feminino (opcional, ajuda na entrega)
  status text not null default 'pending_payment',
  valor numeric not null default 60,
  payment_id text,
  payment_status text,
  payment_method text,
  delivered boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index para ordenar por data (usado pelo painel admin)
create index if not exists inscricoes_created_at_idx on public.inscricoes (created_at desc);

-- Segurança por linha (RLS)
alter table public.inscricoes enable row level security;

-- Remove políticas antigas antes de recriar (seguro rodar mais de uma vez)
drop policy if exists "anon insert inscricoes" on public.inscricoes;
drop policy if exists "authenticated select inscricoes" on public.inscricoes;
drop policy if exists "authenticated update inscricoes" on public.inscricoes;

-- Qualquer visitante pode se inscrever (usado pelo formulário da camisa)
create policy "anon insert inscricoes"
  on public.inscricoes
  for insert
  to anon
  with check (true);

-- Só usuários logados (conta do admin no Supabase Auth) podem LER o painel
create policy "authenticated select inscricoes"
  on public.inscricoes
  for select
  to authenticated
  using (true);

-- Só usuários logados (admin) podem ATUALIZAR (marcar como entregue, etc.)
create policy "authenticated update inscricoes"
  on public.inscricoes
  for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================
--  TABELA DE VISITAS — monitoramento de acessos ao site
-- ============================================================
create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  path text,
  ip text,
  user_agent text,
  referrer text
);

create index if not exists visitas_created_at_idx on public.visitas (created_at desc);
create index if not exists visitas_ip_idx on public.visitas (ip);

alter table public.visitas enable row level security;

drop policy if exists "anon insert visitas" on public.visitas;
drop policy if exists "authenticated select visitas" on public.visitas;

-- A Edge Function track-visit usa service_role e insere via service key (bypassa RLS),
-- mas liberamos anon insert como fallback caso a função seja chamada sem service key.
create policy "anon insert visitas"
  on public.visitas for insert to anon with check (true);

create policy "authenticated select visitas"
  on public.visitas for select to authenticated using (true);

-- Habilita Realtime para a tabela visitas (para o painel em tempo real)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visitas'
  ) then
    execute 'alter publication supabase_realtime add table public.visitas';
  end if;
exception when others then
  null;
end $$;
