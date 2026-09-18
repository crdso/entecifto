// ENTEC 2026 — Check-in por QR (credenciamento)
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//          EVENT_REGISTRATION_SECRET, ADMIN_EMAIL (fail-closed se ausente)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const EVENT_REGISTRATION_SECRET = Deno.env.get("EVENT_REGISTRATION_SECRET");
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
  let allowOrigin = "*";
  if (origin && ALLOWED_ORIGINS.includes(origin)) allowOrigin = origin;
  else if (origin && (origin.includes("localhost") || origin.includes("127.0.0.1"))) allowOrigin = origin;
  else if (origin === "") allowOrigin = "*";
  else allowOrigin = "https://entecifto.online";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isValidTicketId(v: string): boolean {
  return /^ENTEC26-[A-F0-9]{12}$/.test(v);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY || !EVENT_REGISTRATION_SECRET) {
    return new Response(JSON.stringify({ error: "Função não configurada." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ADMIN_EMAIL fail-closed
  if (!ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: "ADMIN_EMAIL não configurado nos Edge Function Secrets. Configure ADMIN_EMAIL para liberar o credenciamento." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Valida JWT e verifica se é admin
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

  const action = String((body as Record<string, unknown>).action || "").trim().toLowerCase();
  const isQrAction = ["lookup", "confirm"].includes(action);
  const isManualAction = ["manual_confirm", "manual_remove"].includes(action);

  if (!action || (!isQrAction && !isManualAction)) {
    return new Response(JSON.stringify({ error: "Ação inválida. Use lookup, confirm, manual_confirm ou manual_remove." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Manual actions via registration_id
  if (isManualAction) {
    const registrationId = String((body as Record<string, unknown>).registration_id || (body as Record<string, unknown>).id || "").trim();
    if (!registrationId) {
      return new Response(JSON.stringify({ error: "registration_id obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: reg, error: fetchErr } = await supabase.from("event_registrations").select("id, name, email, created_at, attendance_confirmed, attendance_confirmed_at, wallet_status").eq("id", registrationId).single();
      if (fetchErr || !reg) {
        return new Response(JSON.stringify({ error: "Participante não encontrado." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const participant = {
        id: (reg as Record<string, unknown>).id,
        name: (reg as Record<string, unknown>).name,
        email: (reg as Record<string, unknown>).email,
        created_at: (reg as Record<string, unknown>).created_at,
        attendance_confirmed: (reg as Record<string, unknown>).attendance_confirmed,
        attendance_confirmed_at: (reg as Record<string, unknown>).attendance_confirmed_at,
        wallet_status: (reg as Record<string, unknown>).wallet_status,
      };
      if (action === "manual_confirm") {
        if (participant.attendance_confirmed) {
          return new Response(JSON.stringify({ ok: true, status: "already_confirmed", participant }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const nowIso = new Date().toISOString();
        const { data: updated, error: updErr } = await supabase.from("event_registrations").update({ attendance_confirmed: true, attendance_confirmed_at: nowIso, attendance_confirmed_by: user.id }).eq("id", participant.id).eq("attendance_confirmed", false).select("id, name, email, created_at, attendance_confirmed, attendance_confirmed_at, wallet_status").single();
        if (updErr || !updated) {
          const { data: recheck } = await supabase.from("event_registrations").select("id, name, email, created_at, attendance_confirmed, attendance_confirmed_at, wallet_status").eq("id", participant.id).single();
          if (recheck && (recheck as Record<string, unknown>).attendance_confirmed) {
            return new Response(JSON.stringify({ ok: true, status: "already_confirmed", participant: { id: (recheck as Record<string, unknown>).id, name: (recheck as Record<string, unknown>).name, email: (recheck as Record<string, unknown>).email, created_at: (recheck as Record<string, unknown>).created_at, attendance_confirmed: true, attendance_confirmed_at: (recheck as Record<string, unknown>).attendance_confirmed_at, wallet_status: (recheck as Record<string, unknown>).wallet_status } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          return new Response(JSON.stringify({ error: "Não foi possível confirmar. Tente novamente." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: true, status: "confirmed", participant: { id: (updated as Record<string, unknown>).id, name: (updated as Record<string, unknown>).name, email: (updated as Record<string, unknown>).email, created_at: (updated as Record<string, unknown>).created_at, attendance_confirmed: true, attendance_confirmed_at: (updated as Record<string, unknown>).attendance_confirmed_at, wallet_status: (updated as Record<string, unknown>).wallet_status } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        // manual_remove
        if (!participant.attendance_confirmed) {
          return new Response(JSON.stringify({ ok: true, status: "already_pending", participant }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: updated, error: updErr } = await supabase.from("event_registrations").update({ attendance_confirmed: false, attendance_confirmed_at: null, attendance_confirmed_by: null }).eq("id", participant.id).eq("attendance_confirmed", true).select("id, name, email, created_at, attendance_confirmed, attendance_confirmed_at, wallet_status").single();
        if (updErr || !updated) {
          return new Response(JSON.stringify({ error: "Não foi possível remover. Tente novamente." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ ok: true, status: "removed", participant: { id: (updated as Record<string, unknown>).id, name: (updated as Record<string, unknown>).name, email: (updated as Record<string, unknown>).email, created_at: (updated as Record<string, unknown>).created_at, attendance_confirmed: false, attendance_confirmed_at: null, wallet_status: (updated as Record<string, unknown>).wallet_status } }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: "Erro interno." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const ticketIdRaw = String((body as Record<string, unknown>).ticket_id || (body as Record<string, unknown>).ticketId || "").trim().toUpperCase();
  if (!ticketIdRaw || !isValidTicketId(ticketIdRaw)) {
    return new Response(JSON.stringify({ error: "Credencial inválida." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const hash = await hmacHex(EVENT_REGISTRATION_SECRET, ticketIdRaw);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Lookup
    const { data: reg, error: fetchErr } = await supabase
      .from("event_registrations")
      .select("id, name, email, created_at, attendance_confirmed, attendance_confirmed_at, wallet_status")
      .eq("checkin_token_hash", hash)
      .single();

    if (fetchErr || !reg) {
      return new Response(JSON.stringify({ error: "Credencial não encontrada." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const participant = {
      id: (reg as Record<string, unknown>).id,
      name: (reg as Record<string, unknown>).name,
      email: (reg as Record<string, unknown>).email,
      created_at: (reg as Record<string, unknown>).created_at,
      attendance_confirmed: (reg as Record<string, unknown>).attendance_confirmed,
      attendance_confirmed_at: (reg as Record<string, unknown>).attendance_confirmed_at,
      wallet_status: (reg as Record<string, unknown>).wallet_status,
    };

    if (action === "lookup") {
      if (participant.attendance_confirmed) {
        return new Response(JSON.stringify({ ok: true, status: "already_confirmed", participant }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, status: "found", participant }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // action === "confirm"
    if (participant.attendance_confirmed) {
      return new Response(JSON.stringify({ ok: true, status: "already_confirmed", participant }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Confirm com proteção contra concorrência: só atualiza se ainda pendente
    const nowIso = new Date().toISOString();
    const { data: updated, error: updErr } = await supabase
      .from("event_registrations")
      .update({
        attendance_confirmed: true,
        attendance_confirmed_at: nowIso,
        attendance_confirmed_by: user.id,
      })
      .eq("id", participant.id)
      .eq("attendance_confirmed", false)
      .select("id, name, email, created_at, attendance_confirmed, attendance_confirmed_at, wallet_status")
      .single();

    if (updErr || !updated) {
      // Pode ter sido confirmado entre lookup e confirm (corrida) — busca estado atual
      const { data: recheck } = await supabase
        .from("event_registrations")
        .select("id, name, email, created_at, attendance_confirmed, attendance_confirmed_at, wallet_status")
        .eq("id", participant.id)
        .single();
      if (recheck && (recheck as Record<string, unknown>).attendance_confirmed) {
        return new Response(JSON.stringify({
          ok: true,
          status: "already_confirmed",
          participant: {
            id: (recheck as Record<string, unknown>).id,
            name: (recheck as Record<string, unknown>).name,
            email: (recheck as Record<string, unknown>).email,
            created_at: (recheck as Record<string, unknown>).created_at,
            attendance_confirmed: true,
            attendance_confirmed_at: (recheck as Record<string, unknown>).attendance_confirmed_at,
            wallet_status: (recheck as Record<string, unknown>).wallet_status,
          },
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Não foi possível confirmar. Tente novamente." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const confirmedParticipant = {
      id: (updated as Record<string, unknown>).id,
      name: (updated as Record<string, unknown>).name,
      email: (updated as Record<string, unknown>).email,
      created_at: (updated as Record<string, unknown>).created_at,
      attendance_confirmed: true,
      attendance_confirmed_at: (updated as Record<string, unknown>).attendance_confirmed_at,
      wallet_status: (updated as Record<string, unknown>).wallet_status,
    };

    return new Response(JSON.stringify({ ok: true, status: "confirmed", participant: confirmedParticipant }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Erro interno." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
