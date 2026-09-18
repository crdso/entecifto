-- ============================================================
--  ENTEC 2026 — Inscrições do Evento (event_registrations)
--  Rode este script no SQL Editor do Supabase
--  (Dashboard -> SQL Editor -> New query -> Run)
--  Não altera a tabela legada public.inscricoes (camisas)
-- ============================================================

-- pgcrypto para gen_random_uuid() quando necessário
create extension if not exists "pgcrypto";

-- Tabela principal de inscrições no evento
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  cpf_hash text not null unique,
  cpf_last4 text not null,
  lookup_hash text not null unique,
  attendance_confirmed boolean not null default false,
  certificate_ready boolean not null default false,
  certificate_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create index if not exists event_registrations_created_at_idx
  on public.event_registrations (created_at desc);
create index if not exists event_registrations_cpf_hash_idx
  on public.event_registrations (cpf_hash);
create index if not exists event_registrations_lookup_hash_idx
  on public.event_registrations (lookup_hash);
create index if not exists event_registrations_email_idx
  on public.event_registrations (lower(email));

-- Trigger para updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_event_registrations_updated_at on public.event_registrations;
create trigger trg_event_registrations_updated_at
  before update on public.event_registrations
  for each row execute function public.set_updated_at();

-- RLS
alter table public.event_registrations enable row level security;

-- Remove políticas antigas (idempotente)
drop policy if exists "authenticated select event_registrations" on public.event_registrations;
drop policy if exists "authenticated update event_registrations" on public.event_registrations;
drop policy if exists "authenticated delete event_registrations" on public.event_registrations;
drop policy if exists "anon select event_registrations" on public.event_registrations;
drop policy if exists "anon insert event_registrations" on public.event_registrations;
drop policy if exists "anon update event_registrations" on public.event_registrations;
drop policy if exists "anon delete event_registrations" on public.event_registrations;

-- Nenhum acesso anônimo direto: inscrições apenas via Edge Function (service_role)
-- Authenticated (painel admin) pode ler e atualizar/ deletar
create policy "authenticated select event_registrations"
  on public.event_registrations
  for select
  to authenticated
  using (true);

create policy "authenticated update event_registrations"
  on public.event_registrations
  for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated delete event_registrations"
  on public.event_registrations
  for delete
  to authenticated
  using (true);
