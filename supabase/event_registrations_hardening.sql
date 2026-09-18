-- ============================================================
--  ENTEC 2026 — Hardening final event_registrations
--  - Remove SELECT de tabela inteira para authenticated
--  - Concede SELECT apenas em colunas seguras para /admin
--  - Remove UPDATE/DELETE direto (agora via event-checkin)
--  - Realtime passa a receber apenas colunas seguras
--  Rode no SQL Editor do Supabase
-- ============================================================

-- Revoga acesso amplo (tabela inteira) — mantém RLS mas bloqueia colunas sensíveis
revoke select on table public.event_registrations from authenticated;
revoke select on table public.event_registrations from anon;

-- Concede SELECT apenas nas colunas necessárias ao /admin (sem dados sensíveis)
grant select (
  id,
  name,
  email,
  cpf_last4,
  created_at,
  updated_at,
  attendance_confirmed,
  attendance_confirmed_at,
  attendance_confirmed_by,
  wallet_status,
  wallet_created_at,
  certificate_ready
)
on table public.event_registrations
to authenticated;

-- Remover UPDATE/DELETE direto — agora via event-checkin + ADMIN_EMAIL (service_role continua)
revoke update on table public.event_registrations from authenticated;
revoke update on table public.event_registrations from anon;
revoke delete on table public.event_registrations from authenticated;
revoke delete on table public.event_registrations from anon;

-- Garante que service_role continua com acesso total (bypass RLS já, mas privilegio de tabela)
grant all on table public.event_registrations to service_role;

-- Comentário
comment on table public.event_registrations is 'Hardening: authenticated só lê colunas seguras via GRANT SELECT(colunas). Escritas via service_role (event-checkin).';
