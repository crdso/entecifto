// ENTEC 2026 — Pódio dos Stands (resultados oficiais)
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//          ADMIN_EMAIL (fail-closed para ações administrativas)
// Modelo: o admin lança uma NOTA (0–10) por grupo; o ranking é
// calculado automaticamente pela maior nota (empate = alfabética).
// Público (sem login): action "public_status" — recebe nomes e notas
// SOMENTE quando results_released = true. Antes disso, recebe apenas
// { released: false } (sem nomes, sem notas no payload).
// Admin (JWT + ADMIN_EMAIL): "admin_get" | "save_scores" | "release".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase();

const ALLOWED_ORIGINS = [
  "https://entecifto.online",
  "https://www.entecifto.online",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

// Grupos participantes oficiais — escrita exata exigida pelo regulamento.
const STAND_GROUPS = [
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
] as const;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allowOrigin = "*";
  if (origin && ALLOWED_ORIGINS.includes(origin)) allowOrigin = origin;
  else if (origin && (origin.includes("localhost") || origin.includes("127.0.0.1"))) allowOrigin = origin;
  else if (origin === "") allowOrigin = "*";
  else allowOrigin = "https://entecifto.online";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, req?: Request) {
  const headers = req ? getCorsHeaders(req) : { "Access-Control-Allow-Origin": "*" };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

type StandRow = {
  id: number;
  first_place: string | null;
  second_place: string | null;
  third_place: string | null;
  results_released: boolean;
  released_at: string | null;
  updated_at: string | null;
};

type ScoreEntry = { group: string; score: number };

// Ranking canônico: maior nota primeiro; empate = ordem alfabética.
function computeRanking(scores: ScoreEntry[]): ScoreEntry[] {
  return [...scores].sort(
    (a, b) => b.score - a.score || a.group.localeCompare(b.group, "pt-BR")
  );
}

function parseScores(input: unknown): { scores?: ScoreEntry[]; error?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Informe a nota de cada um dos 10 grupos." };
  }
  const obj = input as Record<string, unknown>;
  const out: ScoreEntry[] = [];
  for (const g of STAND_GROUPS) {
    const raw = obj[g];
    const n = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      return { error: `Nota inválida para "${g}". Use um valor de 0 a 10.` };
    }
    out.push({ group: g, score: Math.round(n * 100) / 100 });
  }
  return { scores: out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json({ error: "Função não configurada." }, 500, req);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  async function loadRow(): Promise<StandRow | null> {
    const { data, error } = await supabase
      .from("event_stand_results")
      .select("id, first_place, second_place, third_place, results_released, released_at, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error("Falha ao consultar o resultado.");
    return (data as StandRow | null) ?? null;
  }

  // Tolera a tabela de notas ainda não criada (migration pendente):
  // retorna lista vazia em vez de quebrar o status público.
  async function loadScores(): Promise<ScoreEntry[]> {
    const { data, error } = await supabase
      .from("event_stand_scores")
      .select("group_name, score");
    if (error) return [];
    const rows = (data as Array<{ group_name: string; score: number }> | null) ?? [];
    return rows
      .filter(
        (r) =>
          (STAND_GROUPS as readonly string[]).includes(r.group_name) &&
          Number.isFinite(Number(r.score))
      )
      .map((r) => ({ group: r.group_name, score: Number(r.score) }));
  }

  function scoresMap(list: ScoreEntry[]): Record<string, number> {
    const m: Record<string, number> = {};
    for (const s of list) m[s.group] = s.score;
    return m;
  }

  function publicPayload(row: StandRow | null, scores: ScoreEntry[]) {
    if (!row || !row.results_released) {
      return { released: false, released_at: null };
    }
    const top = computeRanking(scores).slice(0, 3);
    if (top.length < 3) {
      return { released: false, released_at: null };
    }
    return {
      released: true,
      released_at: row.released_at,
      first: top[0].group,
      second: top[1].group,
      third: top[2].group,
      first_score: top[0].score,
      second_score: top[1].score,
      third_score: top[2].score,
    };
  }

  // GET público = status (conveniência para diagnóstico; POST é o oficial)
  if (req.method === "GET") {
    try {
      const [row, scores] = await Promise.all([loadRow(), loadScores()]);
      return json(publicPayload(row, scores), 200, req);
    } catch {
      return json({ error: "Não foi possível consultar o resultado." }, 500, req);
    }
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405, req);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Payload inválido." }, 400, req);
  }

  const action = String(body.action || "public_status").trim().toLowerCase();

  // ---- Ação pública: não exige login e nunca expõe nomes/notas antes da liberação
  if (action === "public_status" || action === "status") {
    try {
      const [row, scores] = await Promise.all([loadRow(), loadScores()]);
      return json(publicPayload(row, scores), 200, req);
    } catch {
      return json({ error: "Não foi possível consultar o resultado." }, 500, req);
    }
  }

  // ---- Ações administrativas: JWT + ADMIN_EMAIL (fail-closed)
  if (!ADMIN_EMAIL) {
    return json({ error: "ADMIN_EMAIL não configurado nos Edge Function Secrets." }, 500, req);
  }
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Não autorizado." }, 401, req);

  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
  if (authErr || !user) return json({ error: "Não autorizado." }, 401, req);
  if ((user.email || "").trim().toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: "Acesso restrito." }, 403, req);
  }

  try {
    if (action === "admin_get") {
      const [row, scores] = await Promise.all([loadRow(), loadScores()]);
      return json(
        {
          configured: scores.length === STAND_GROUPS.length,
          scores: scoresMap(scores),
          ranking: computeRanking(scores),
          results_released: row?.results_released ?? false,
          released_at: row?.released_at ?? null,
          updated_at: row?.updated_at ?? null,
        },
        200,
        req
      );
    }

    if (action === "save_scores") {
      const parsed = parseScores(body.scores);
      if (!parsed.scores) return json({ error: parsed.error }, 400, req);

      const current = await loadRow();
      const alreadyReleased = Boolean(current?.results_released);
      // Salvar NÃO libera: mantém o flag atual. Se já estava liberado,
      // atualiza released_at para que visitantes recebam a nova versão
      // (e revejam a animação uma vez).
      const nowIso = new Date().toISOString();
      const rows = parsed.scores.map((s) => ({
        group_name: s.group,
        score: s.score,
        updated_at: nowIso,
      }));
      const { error } = await supabase
        .from("event_stand_scores")
        .upsert(rows, { onConflict: "group_name" });
      if (error) {
        const msg = String(error.message || "");
        if (msg.includes("event_stand_scores") || (error as { code?: string }).code === "42P01") {
          return json(
            { error: "Tabela de notas ainda não criada. Rode supabase/event_stand_scores.sql no SQL Editor." },
            500,
            req
          );
        }
        return json({ error: "Não foi possível salvar as notas." }, 500, req);
      }
      let releasedAt = current?.released_at ?? null;
      if (alreadyReleased) {
        releasedAt = nowIso;
        const top = computeRanking(parsed.scores).slice(0, 3);
        await supabase
          .from("event_stand_results")
          .update({
            first_place: top[0].group,
            second_place: top[1].group,
            third_place: top[2].group,
            released_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", 1);
      }
      return json(
        {
          ok: true,
          saved: true,
          ranking: computeRanking(parsed.scores),
          results_released: alreadyReleased,
          released_at: releasedAt,
        },
        200,
        req
      );
    }

    if (action === "release") {
      const [current, scores] = await Promise.all([loadRow(), loadScores()]);
      if (scores.length < STAND_GROUPS.length) {
        return json({ error: "Lance a nota dos 10 grupos antes de liberar." }, 400, req);
      }
      const top = computeRanking(scores).slice(0, 3);
      if (current?.results_released) {
        return json(
          { ok: true, released: true, already: true, released_at: current.released_at },
          200,
          req
        );
      }
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("event_stand_results")
        .update({
          first_place: top[0].group,
          second_place: top[1].group,
          third_place: top[2].group,
          results_released: true,
          released_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", 1);
      if (error) return json({ error: "Não foi possível liberar os resultados." }, 500, req);
      return json(
        {
          ok: true,
          released: true,
          ranking: top,
          released_at: nowIso,
        },
        200,
        req
      );
    }

    return json({ error: "Ação inválida." }, 400, req);
  } catch {
    return json({ error: "Erro interno." }, 500, req);
  }
});
