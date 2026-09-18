-- ============================================================
--  ENTEC 2026 — Wallet PassFast (incremental)
--  Não recria a tabela event_registrations, apenas adiciona
--  colunas necessárias para credencial digital.
--  Rode no SQL Editor do Supabase (Dashboard -> SQL Editor)
-- ============================================================

-- Colunas para QR / credencial
alter table public.event_registrations
  add column if not exists checkin_token text,
  add column if not exists checkin_token_hash text,
  add column if not exists pass_serial text,
  add column if not exists wallet_status text not null default 'pending',
  add column if not exists wallet_access_hash text,
  add column if not exists passfast_apple_id text,
  add column if not exists passfast_apple_download_url text,
  add column if not exists passfast_google_id text,
  add column if not exists passfast_google_save_url text,
  add column if not exists wallet_created_at timestamptz,
  add column if not exists wallet_error text;

-- Índices únicos (permitem múltiplos NULLs no Postgres)
create unique index if not exists event_registrations_checkin_token_hash_idx
  on public.event_registrations (checkin_token_hash) where checkin_token_hash is not null;

create unique index if not exists event_registrations_pass_serial_idx
  on public.event_registrations (pass_serial) where pass_serial is not null;

create unique index if not exists event_registrations_wallet_access_hash_idx
  on public.event_registrations (wallet_access_hash) where wallet_access_hash is not null;

create index if not exists event_registrations_wallet_status_idx
  on public.event_registrations (wallet_status);

-- Comentários para documentação
comment on column public.event_registrations.checkin_token is 'Token aleatório do QR (ENTEC26-...), usado como ticket_id no PassFast. Mantido para retry; verificação via checkin_token_hash.';
comment on column public.event_registrations.checkin_token_hash is 'HMAC-SHA256(EVENT_REGISTRATION_SECRET, checkin_token) — verificação do QR sem expor token puro.';
comment on column public.event_registrations.pass_serial is 'Serial único PassFast formato ENTEC26-XXXXXXXXXXXX';
comment on column public.event_registrations.wallet_status is 'pending | ready | error — estado da credencial digital';
comment on column public.event_registrations.wallet_access_hash is 'HMAC-SHA256(EVENT_REGISTRATION_SECRET, wallet_access_token) — acesso opaco à carteira via event-wallet';
