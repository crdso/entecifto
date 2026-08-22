// Helpers mínimos para acessar o Supabase via REST (PostgREST) e Auth.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED } from "./supabaseConfig";

export const supabase = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Sem token usa a anon key (válido para inscrições públicas).
// Com token usa o access_token da sessão logada (admin).
function baseHeaders(json = false, token) {
  const h = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function ensureConfigured() {
  if (!SUPABASE_CONFIGURED)
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
}

// Insere uma linha. Como o visitante não tem permissão de leitura (anon),
// não usamos "return=representation" (evita erro de RLS no retorno).
// O id é gerado no frontend e devolvido junto com a linha.
export async function insertRow(table, row) {
  ensureConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: baseHeaders(true),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Falha ao salvar (${res.status}). ${t}`);
  }
  return { ...row, id: row.id };
}

// Lista linhas. qs = query string PostgREST (ex.: "order=created_at.desc&limit=1000").
// token = access_token do usuário logado (para o admin). Omita para uso anônimo.
export async function selectRows(table, qs = "", token) {
  ensureConfigured();
  const url = qs ? `${SUPABASE_URL}/rest/v1/${table}?${qs}` : `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, { headers: baseHeaders(false, token) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Falha ao listar (${res.status}). ${t}`);
  }
  return res.json();
}

// Deleta linhas que casam com `match` (ex.: "id=eq.xxx").
export async function deleteRow(table, match, token) {
  ensureConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
    method: "DELETE",
    headers: baseHeaders(false, token),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Falha ao deletar (${res.status}). ${t}`);
  }
  return true;
}

// Atualiza linhas que casam com `match` (ex.: "id=eq.xxx").
// token = access_token do usuário logado (para o admin). Omita para uso anônimo.
export async function updateRow(table, match, patch, token) {
  ensureConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
    method: "PATCH",
    headers: { ...baseHeaders(true, token), Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Falha ao atualizar (${res.status}). ${t}`);
  }
  return res.json();
}

// Chama uma Edge Function do Supabase com corpo JSON.
export async function callFunction(name, payload = {}) {
  ensureConfigured();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Falha ao chamar ${name} (${res.status}).`);
  }
  return data;
}