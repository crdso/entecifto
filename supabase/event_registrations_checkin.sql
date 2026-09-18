-- ============================================================
--  ENTEC 2026 — Check-in por QR (incremental)
--  Não recria event_registrations, apenas adiciona colunas
--  de auditoria do credenciamento.
--  Rode no SQL Editor do Supabase
-- ============================================================

alter table public.event_registrations
  add column if not exists attendance_confirmed_at timestamptz null,
  add column if not exists attendance_confirmed_by uuid null;

comment on column public.event_registrations.attendance_confirmed_at is 'Horário em que a presença foi confirmada via QR (event-checkin) ou manualmente pelo admin. NULL enquanto pendente.';
comment on column public.event_registrations.attendance_confirmed_by is 'ID do usuário admin (auth.users.id) que confirmou a presença. NULL enquanto pendente ou se confirmado antes desta coluna existir.';

-- Índice para consultas de presença por horário
create index if not exists event_registrations_attendance_confirmed_at_idx
  on public.event_registrations (attendance_confirmed_at desc) where attendance_confirmed_at is not null;

-- Participantes já com attendance_confirmed=true e attendance_confirmed_at NULL permanecem assim (sem horário retroativo)
