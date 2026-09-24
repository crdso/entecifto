// ENTEC 2026 — Serviço do pódio dos stands (/resultados).
// Todo o acesso passa pela Edge Function `event-results`:
// - público: recebe nomes e notas SOMENTE quando results_released = true;
// - admin: escrita exige access_token de admin (validado no servidor
//   via ADMIN_EMAIL — nunca confie apenas no frontend).
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED } from "./supabaseConfig";

// Grupos participantes oficiais — escrita exata, sem alterações.
export const STAND_GROUPS = [
  "SmartCity",
  "FutureHouse",
  "TechSocial",
  "Os anônimos",
  "MeteoLab",
  "My Technology",
  "Lan Room",
  "BioTech",
  "PlayZone",
  "Mentes Conectadas",
];

// Ranking canônico (mesma regra do backend): maior nota primeiro;
// empate = ordem alfabética do grupo.
export function computeRanking(scores) {
  const list = STAND_GROUPS.filter((g) => Number.isFinite(Number(scores?.[g]))).map((g) => ({
    group: g,
    score: Number(scores[g]),
  }));
  return list.sort(
    (a, b) => b.score - a.score || a.group.localeCompare(b.group, "pt-BR")
  );
}

// Exibe a nota no padrão brasileiro (ex.: 9,4).
export function formatScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function ensureConfigured() {
  if (!SUPABASE_CONFIGURED) {
    throw new Error("Supabase não configurado.");
  }
}

async function postResults(payload, token) {
  ensureConfigured();
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const res = await fetch(`${SUPABASE_URL}/functions/v1/event-results`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Falha ao consultar resultados (${res.status}).`);
  }
  return data;
}

// Público: { released, released_at, first?, second?, third?,
//            first_score?, second_score?, third_score? }
// Quando released = false, NÃO há nomes nem notas no payload.
export function getPublicResults() {
  return postResults({ action: "public_status" });
}

// Admin (access_token do painel): notas + ranking + estado de liberação.
export function getAdminResults(token) {
  return postResults({ action: "admin_get" }, token);
}

// Admin: salva as notas SEM liberar (mantém results_released atual).
export function saveScores(token, scores) {
  return postResults({ action: "save_scores", scores }, token);
}

// Admin: libera oficialmente (exige nota dos 10 grupos).
export function releaseResults(token) {
  return postResults({ action: "release" }, token);
}

// Chave do localStorage por publicação — uma nova publicação
// (novo released_at) dispara a animação uma vez novamente.
export function seenKeyFor(releasedAt) {
  const stamp = String(releasedAt || "v1").replace(/[^a-zA-Z0-9]/g, "");
  return `entec_2026_results_seen_${stamp}`;
}

// Chave separada da PRÉVIA do admin — nunca interfere na
// animação real que o visitante verá após a liberação oficial.
export function previewSeenKey() {
  return "entec_2026_results_preview_seen_v1";
}
