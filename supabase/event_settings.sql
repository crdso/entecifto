-- ============================================================
--  ENTEC 2026 — Configurações editáveis pelo painel admin
--  Rode este script no SQL Editor do Supabase
--  (Dashboard -> SQL Editor -> New query -> Run)
--
--  Chaves usadas pelo site:
--    registrations_open = 'true' | 'false'
--      'false' fecha as inscrições (página /inscricao mostra
--      "Inscrições encerradas" e a Edge Function event-register
--      rejeita novas inscrições com 403).
-- ============================================================

create table if not exists public.event_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Valor padrão: inscrições abertas (não sobrescreve se já existir)
insert into public.event_settings (key, value)
values ('registrations_open', 'true')
on conflict (key) do nothing;

-- RLS
alter table public.event_settings enable row level security;

-- Remove políticas antigas (idempotente)
drop policy if exists "anon select event_settings" on public.event_settings;
drop policy if exists "authenticated select event_settings" on public.event_settings;
drop policy if exists "authenticated write event_settings" on public.event_settings;

-- Site público precisa LER a flag (página /inscricao)
create policy "anon select event_settings"
  on public.event_settings
  for select
  to anon
  using (true);

-- Painel admin (usuário logado) pode ler
create policy "authenticated select event_settings"
  on public.event_settings
  for select
  to authenticated
  using (true);

-- Painel admin (usuário logado) pode criar/atualizar chaves
create policy "authenticated write event_settings"
  on public.event_settings
  for all
  to authenticated
  using (true)
  with check (true);
