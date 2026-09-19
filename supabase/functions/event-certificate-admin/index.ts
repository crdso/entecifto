// Admin — libera/remove certificado
// POST { registration_id, enabled: true/false }
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, ADMIN_EMAIL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase();

const ALLOWED_ORIGINS = [
  "https://entecifto.online",
  "https://www.entecifto.online",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  let allowOrigin = "";
  if (ALLOWED_ORIGINS.includes(origin)) allowOrigin = origin;
  else if (origin === "") allowOrigin = "https://entecifto.online";
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
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Função não configurada." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "ADMIN_EMAIL não configurado." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if ((user.email || "").trim().toLowerCase() !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "Acesso restrito." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Payload inválido." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const registrationId = String((body as Record<string, unknown>).registration_id || (body as Record<string, unknown>).id || "").trim();
  const enabledRaw = (body as Record<string, unknown>).enabled;
  const actionRaw = String((body as Record<string, unknown>).action || "").trim().toLowerCase();

  let enabled: boolean | null = null;
  if (typeof enabledRaw === "boolean") enabled = enabledRaw;
  else if (actionRaw === "certificate_enable") enabled = true;
  else if (actionRaw === "certificate_disable") enabled = false;
  else if (actionRaw === "enable") enabled = true;
  else if (actionRaw === "disable") enabled = false;

  if (!registrationId) {
    return new Response(JSON.stringify({ error: "registration_id obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (enabled === null) {
    return new Response(JSON.stringify({ error: "enabled obrigatório (true/false)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: updated, error } = await supabase.from("event_registrations").update({ certificate_ready: enabled }).eq("id", registrationId).select("id, certificate_ready").single();
  if (error) {
    return new Response(JSON.stringify({ error: "Falha ao atualizar." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true, id: updated.id, certificate_ready: updated.certificate_ready }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
