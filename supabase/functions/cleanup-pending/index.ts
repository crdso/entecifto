// Deleta inscrições pendentes expiradas — APENAS admin autenticado.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, ADMIN_EMAIL (fail-closed)
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

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allowOrigin = "";
  if (ALLOWED_ORIGINS.includes(origin)) allowOrigin = origin;
  else if (origin === "") allowOrigin = "https://entecifto.online";
  else allowOrigin = ""; // não reflete origin fora da allowlist
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
  return headers;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Função não configurada." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ADMIN_EMAIL fail-closed
  if (!ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "ADMIN_EMAIL não configurado nos Edge Function Secrets." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if ((user.email || "").trim().toLowerCase() !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "Acesso restrito." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const all = (body as Record<string, unknown>).all === true;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let query = supabase.from("inscricoes").delete().eq("status", "pending_payment");
    if (!all) {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      query = query.lt("created_at", cutoff);
    }

    const { data, error } = await query.select("id");
    if (error) throw error;

    return new Response(JSON.stringify({ deleted: data?.length ?? 0, all }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Erro inesperado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
