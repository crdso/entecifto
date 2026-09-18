// ENTEC 2026 — Wallet download / retry seguro
// Secrets: EVENT_REGISTRATION_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//          PASSFAST_API_KEY, PASSFAST_PROJECT_ID, PASSFAST_TEMPLATE_ID
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EVENT_REGISTRATION_SECRET = Deno.env.get("EVENT_REGISTRATION_SECRET");
const PASSFAST_API_KEY = Deno.env.get("PASSFAST_API_KEY");
const PASSFAST_PROJECT_ID = Deno.env.get("PASSFAST_PROJECT_ID");
const PASSFAST_TEMPLATE_ID = Deno.env.get("PASSFAST_TEMPLATE_ID");

const ALLOWED_ORIGINS = [
  "https://entecifto.online",
  "https://www.entecifto.online",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomHex(len: number): string {
  const bytes = new Uint8Array(Math.ceil(len / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, len).toUpperCase();
}
function resolvePassFastUrl(value: string): string {
  if (!value) throw new Error("PassFast download URL ausente");
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const relative = value.replace(/^\/+/, "");
  return new URL(relative, "https://api.passfa.st/functions/v1/").toString();
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // POST — admin retry (requires authenticated admin)
  if (req.method === "POST") {
    try {
      const auth = req.headers.get("authorization") || "";
      const token = auth.replace("Bearer ", "").trim();
      if (!token) {
        return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Verify admin via supabase auth
      const supabaseAnon = createClient(SUPABASE_URL!, Deno.env.get("SUPABASE_ANON_KEY") || "", { auth: { persistSession: false } });
      // Use service role to verify? Simpler: use anon client to get user
      const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const adminEmail = (Deno.env.get("ADMIN_EMAIL") || Deno.env.get("VITE_ADMIN_EMAIL") || "").toLowerCase();
      if (adminEmail && user.email?.toLowerCase() !== adminEmail) {
        return new Response(JSON.stringify({ error: "Acesso restrito." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      const registrationId = (body as Record<string, unknown>).registration_id as string || (body as Record<string, unknown>).id as string;
      if (!registrationId) {
        return new Response(JSON.stringify({ error: "registration_id obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVENT_REGISTRATION_SECRET || !PASSFAST_API_KEY || !PASSFAST_PROJECT_ID || !PASSFAST_TEMPLATE_ID) {
        return new Response(JSON.stringify({ error: "Função não configurada." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: reg, error: fetchErr } = await supabase.from("event_registrations").select("*").eq("id", registrationId).single();
      if (fetchErr || !reg) {
        return new Response(JSON.stringify({ error: "Inscrição não encontrada." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Reuse stored tokens if available, otherwise generate new
      let checkinToken = (reg as Record<string, unknown>).checkin_token as string | null;
      let passSerial = (reg as Record<string, unknown>).pass_serial as string | null;
      if (!checkinToken) {
        checkinToken = `ENTEC26-${randomHex(12)}`;
        const hash = await hmacHex(EVENT_REGISTRATION_SECRET, checkinToken);
        await supabase.from("event_registrations").update({ checkin_token: checkinToken, checkin_token_hash: hash }).eq("id", registrationId);
      }
      if (!passSerial) {
        passSerial = `ENTEC26-${randomHex(12)}`;
        await supabase.from("event_registrations").update({ pass_serial: passSerial }).eq("id", registrationId);
      }
      // Call PassFast with get_or_create
      const startedAt = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        const passRes = await fetch("https://api.passfa.st/functions/v1/generate-pass", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${PASSFAST_API_KEY}`,
            "X-App-Id": PASSFAST_PROJECT_ID,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_id: PASSFAST_TEMPLATE_ID,
            serial_number: passSerial,
            wallet_type: "both",
            external_id: registrationId,
            get_or_create: true,
            data: {
              participante: (reg as Record<string, unknown>).name,
              data: "23/09/2026",
              local: "IFTO Campus Araguatins",
              open_event: "8:00",
              ticket_id: checkinToken,
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        console.log("PassFast generate completed", {
          status: passRes.status,
          duration_ms: Date.now() - startedAt,
        });
        const text = await passRes.text();
        let passData: Record<string, unknown> = {};
        try { passData = text ? JSON.parse(text) : {}; } catch { passData = { raw: text }; }
        if (!passRes.ok) {
          await supabase.from("event_registrations").update({ wallet_status: "error", wallet_error: (passData as Record<string, unknown>).error as string || `PassFast ${passRes.status}` }).eq("id", registrationId);
          return new Response(JSON.stringify({ error: "Falha ao gerar credencial", details: passData }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const apple = (passData as Record<string, unknown>).apple as Record<string, unknown> | undefined;
        const google = (passData as Record<string, unknown>).google as Record<string, unknown> | undefined;
        const dataObj = (passData as Record<string, unknown>).data as Record<string, unknown> | undefined;
        const a = apple || (dataObj?.apple as Record<string, unknown> | undefined);
        const g = google || (dataObj?.google as Record<string, unknown> | undefined);
        let appleUrl: string | null = (a?.download_url as string) || null;
        if (appleUrl) {
          try { appleUrl = resolvePassFastUrl(appleUrl); } catch { /* keep original */ }
        }
        const appleId = (a?.id as string) || null;
        const googleId = (g?.id as string) || null;
        const googleUrl = (g?.save_url as string) || null;
        const hasApple = Boolean(appleId && appleUrl);
        const hasGoogle = Boolean(googleId && googleUrl);
        const walletStatus = (hasApple || hasGoogle) ? "ready" : "error";
        await supabase.from("event_registrations").update({
          passfast_apple_id: appleId,
          passfast_apple_download_url: appleUrl,
          passfast_google_id: googleId,
          passfast_google_save_url: googleUrl,
          wallet_status: walletStatus,
          wallet_created_at: walletStatus === "ready" ? new Date().toISOString() : null,
          wallet_error: walletStatus === "error" ? "Falha ao gerar credencial" : null,
        }).eq("id", registrationId);
        return new Response(JSON.stringify({ ok: true, wallet_status: walletStatus, apple_available: hasApple, google_available: hasGoogle }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          console.warn("PassFast generate timeout", {
            duration_ms: Date.now() - startedAt,
          });
        }
        const msg = (e as Error).name === "AbortError" ? "PassFast timeout" : (e as Error).message;
        await supabase.from("event_registrations").update({ wallet_status: "error", wallet_error: msg }).eq("id", registrationId);
        return new Response(JSON.stringify({ error: msg }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // GET — wallet download
  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || url.searchParams.get("t") || "";
    const type = (url.searchParams.get("type") || url.searchParams.get("wallet") || "apple").toLowerCase();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVENT_REGISTRATION_SECRET) {
      return new Response(JSON.stringify({ error: "Função não configurada." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    try {
      const hash = await hmacHex(EVENT_REGISTRATION_SECRET, token);
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data: reg, error } = await supabase.from("event_registrations").select("*").eq("wallet_access_hash", hash).single();
      if (error || !reg) {
        return new Response(JSON.stringify({ error: "Credencial não encontrada." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const r = reg as Record<string, unknown>;
      if (type === "google") {
        const googleUrl = r.passfast_google_save_url as string | null;
        if (!googleUrl) {
          return new Response(JSON.stringify({ error: "Google Wallet não disponível." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Return JSON with save_url for frontend to redirect, or redirect directly
        // If request is from browser direct, redirect
        return new Response(null, { status: 302, headers: { ...corsHeaders, Location: googleUrl } });
      } else {
        // Apple — usar passfast_apple_id diretamente (SDK oficial)
        const appleId = r.passfast_apple_id as string | null;
        if (!appleId) {
          return new Response(JSON.stringify({ error: "Apple Wallet não disponível." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const resolvedAppleUrl = `https://api.passfa.st/functions/v1/manage-passes/${encodeURIComponent(appleId)}/download`;
        if (!PASSFAST_API_KEY || !PASSFAST_PROJECT_ID) {
          return new Response(JSON.stringify({ error: "Credencial não configurada." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Fetch pkpass server-side
        const passRes = await fetch(resolvedAppleUrl, {
          headers: {
            "Authorization": `Bearer ${PASSFAST_API_KEY}`,
            "X-App-Id": PASSFAST_PROJECT_ID,
          },
        });
        console.log("PassFast Apple download", {
          status: passRes.status,
        });
        if (!passRes.ok) {
          return new Response(JSON.stringify({ error: "Falha ao obter Apple Wallet." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const buf = await passRes.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/vnd.apple.pkpass",
            "Content-Disposition": `attachment; filename="entec26-${(r.pass_serial as string) || "pass"}.pkpass"`,
            "Content-Length": String(buf.byteLength),
            "Cache-Control": "private, no-store",
          },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
