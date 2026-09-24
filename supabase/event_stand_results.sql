-- ============================================================
--  ENTEC 2026 — Pódio dos Stands (event_stand_results)
--  Rode este script no SQL Editor do Supabase
--  (Dashboard -> SQL Editor -> New query -> Run)
--  Não altera nenhuma tabela existente.
-- ============================================================
--  Estratégia de segurança:
--  - A tabela NÃO possui políticas para anon/authenticated
--    (RLS habilitado sem policies = acesso direto negado).
--  - Leitura pública e escrita admin passam SOMENTE pela
--    Edge Function `event-results` (service_role no servidor):
--      * público recebe os nomes SOMENTE quando
--        results_released = true (antes disso, só status);
--      * escrita exige JWT de admin (ADMIN_EMAIL) validado
--        na Edge Function.
-- ============================================================

create table if not exists public.event_stand_results (
  id int primary key default 1,
  first_place text null,
  second_place text null,
  third_place text null,
  results_released boolean not null default false,
  released_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_stand_results_singleton check (id = 1)
);

-- Garante a linha única do pódio (id = 1)
insert into public.event_stand_results (id)
values (1)
on conflict (id) do nothing;

-- RLS: sem policies para anon/authenticated (nega por padrão).
-- Apenas service_role (Edge Function) acessa.
alter table public.event_stand_results enable row level security;
