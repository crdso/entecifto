-- ============================================================
--  ENTEC 2026 — Notas dos Stands (event_stand_scores)
--  Rode este script no SQL Editor do Supabase
--  (Dashboard -> SQL Editor -> New query -> Run)
--  Não altera nenhuma tabela existente.
-- ============================================================
--  Modelo: o admin lança uma NOTA (0–10) por grupo; o ranking
--  (1º/2º/3º) é calculado automaticamente pela maior nota.
--  Empates são desempatados por ordem alfabética do grupo.
--
--  Segurança (mesmo padrão da tabela event_stand_results):
--  - RLS habilitado SEM policies p/ anon/authenticated
--    (acesso direto negado).
--  - Leitura/escrita SOMENTE via Edge Function `event-results`
--    (service_role no servidor). O público recebe notas e nomes
--    SOMENTE quando results_released = true.
-- ============================================================

create table if not exists public.event_stand_scores (
  group_name text primary key,
  score numeric not null,
  updated_at timestamptz not null default now(),
  constraint event_stand_scores_range check (score >= 0 and score <= 10)
);

-- RLS: sem policies para anon/authenticated (nega por padrão).
-- Apenas service_role (Edge Function) acessa.
alter table public.event_stand_scores enable row level security;
