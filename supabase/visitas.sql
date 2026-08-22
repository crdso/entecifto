-- ============================================================
--  MONITORAMENTO DE ACESSOS — rode APENAS este arquivo no
--  SQL Editor do Supabase (Dashboard -> SQL Editor -> New query -> Run).
--  Não precisa rodar o schema.sql novamente.
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

create policy "anon insert visitas"
  on public.visitas for insert to anon with check (true);

create policy "authenticated select visitas"
  on public.visitas for select to authenticated using (true);

-- Habilita Realtime para o painel em tempo real
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
