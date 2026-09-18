// ENTEC 2026 — Inscrição segura do evento + PassFast
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

function json(body: unknown, status = 200, req?: Request) {
  const headers = req ? getCorsHeaders(req) : { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function isValidCPF(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(digits[10]);
}
function isValidEmail(email: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405, req);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVENT_REGISTRATION_SECRET) return json({ error: "Função não configurada." }, 500, req);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Payload inválido." }, 400, req);
    const rawName = typeof (body as Record<string, unknown>).name === "string" ? (body as Record<string, unknown>).name as string : "";
    const rawCpf = typeof (body as Record<string, unknown>).cpf === "string" ? (body as Record<string, unknown>).cpf as string : "";
    const rawBirth = typeof (body as Record<string, unknown>).birthDate === "string" ? (body as Record<string, unknown>).birthDate as string : typeof (body as Record<string, unknown>).birth_date === "string" ? (body as Record<string, unknown>).birth_date as string : typeof (body as Record<string, unknown>).nascimento === "string" ? (body as Record<string, unknown>).nascimento as string : "";
    const rawEmail = typeof (body as Record<string, unknown>).email === "string" ? (body as Record<string, unknown>).email as string : "";

    const name = rawName.trim().replace(/\s+/g, " ");
    const cpfDigits = rawCpf.replace(/\D/g, "");
    const email = rawEmail.trim().toLowerCase();
    const birthDateRaw = rawBirth.trim();

    if (name.length < 3) return json({ error: "Informe um nome válido." }, 400, req);
    if (name.length > 120) return json({ error: "Nome muito longo." }, 400, req);
    if (!email || !isValidEmail(email)) return json({ error: "Informe um e-mail válido." }, 400, req);
    if (cpfDigits.length !== 11) return json({ error: "Informe um CPF válido." }, 400, req);
    if (!isValidCPF(cpfDigits)) return json({ error: "Informe um CPF válido." }, 400, req);
    if (!birthDateRaw) return json({ error: "Informe sua data de nascimento." }, 400, req);
    const birthDateObj = new Date(birthDateRaw);
    if (Number.isNaN(birthDateObj.getTime())) return json({ error: "Data de nascimento inválida." }, 400, req);
    const isoBirth = birthDateObj.toISOString().slice(0, 10);
    const todayIso = new Date().toISOString().slice(0, 10);
    if (isoBirth > todayIso) return json({ error: "Data de nascimento não pode ser no futuro." }, 400, req);
    if (isoBirth < "1900-01-01") return json({ error: "Data de nascimento inválida." }, 400, req);

    const cpfLast4 = cpfDigits.slice(-4);
    const cpfHash = await hmacHex(EVENT_REGISTRATION_SECRET, cpfDigits);
    const lookupHash = await hmacHex(EVENT_REGISTRATION_SECRET, `${cpfDigits}|${isoBirth}`);

    // Tokens
    const checkinToken = `ENTEC26-${randomHex(12)}`;
    const checkinTokenHash = await hmacHex(EVENT_REGISTRATION_SECRET, checkinToken);
    const walletAccessToken = randomHex(32);
    const walletAccessHash = await hmacHex(EVENT_REGISTRATION_SECRET, walletAccessToken);
    const passSerial = `ENTEC26-${randomHex(12)}`;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Insert registration with pending wallet
    const { data, error } = await supabase.from("event_registrations").insert({
      name,
      email,
      cpf_hash: cpfHash,
      cpf_last4: cpfLast4,
      lookup_hash: lookupHash,
      checkin_token: checkinToken,
      checkin_token_hash: checkinTokenHash,
      pass_serial: passSerial,
      wallet_access_hash: walletAccessHash,
      wallet_status: "pending",
    }).select("id, cpf_last4, created_at").single();

    if (error) {
      const msg = (error.message || "").toLowerCase();
      const code = (error as Record<string, unknown>).code as string | undefined;
      if (code === "23505" || msg.includes("duplicate") || msg.includes("unique") || msg.includes("cpf_hash") || msg.includes("lookup_hash")) {
        return json({ error: "Já existe uma inscrição vinculada a este CPF." }, 409, req);
      }
      return json({ error: "Não foi possível concluir sua inscrição. Tente novamente." }, 500, req);
    }

    const registrationId = data.id as string;

    // Try PassFast — inscrição já garantida, falha não deve perder inscrição
    let walletStatus: string = "error";
    let walletError: string | null = null;
    let appleId: string | null = null;
    let appleDownloadUrl: string | null = null;
    let googleId: string | null = null;
    let googleSaveUrl: string | null = null;
    let passfastWarnings: unknown = null;

    const hasPassfastConfig = Boolean(PASSFAST_API_KEY && PASSFAST_PROJECT_ID && PASSFAST_TEMPLATE_ID);

    if (hasPassfastConfig) {
      const startedAt = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        const passRes = await fetch("https://api.passfa.st/functions/v1/generate-pass", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${PASSFAST_API_KEY}`,
            "X-App-Id": PASSFAST_PROJECT_ID!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            template_id: PASSFAST_TEMPLATE_ID,
            serial_number: passSerial,
            wallet_type: "both",
            external_id: registrationId,
            get_or_create: true,
            data: {
              participante: name,
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
        const passText = await passRes.text();
        let passData: Record<string, unknown> = {};
        try { passData = passText ? JSON.parse(passText) : {}; } catch { passData = { raw: passText }; }

        if (!passRes.ok) {
          walletError = (passData as Record<string, unknown>)?.error as string || `PassFast ${passRes.status}`;
          walletStatus = "error";
        } else {
          // Parse response — handle both wrapped and direct
          const apple = (passData as Record<string, unknown>).apple as Record<string, unknown> | undefined;
          const google = (passData as Record<string, unknown>).google as Record<string, unknown> | undefined;
          // Also handle case where response is { data: { apple, google } } or flat
          const dataObj = (passData as Record<string, unknown>).data as Record<string, unknown> | undefined;
          const a = apple || (dataObj?.apple as Record<string, unknown> | undefined);
          const g = google || (dataObj?.google as Record<string, unknown> | undefined);
          if (a) {
            appleId = (a.id as string) || (a.pass_id as string) || null;
            appleDownloadUrl = (a.download_url as string) || (a.url as string) || (a.downloadUrl as string) || null;
          }
          if (g) {
            googleId = (g.id as string) || (g.pass_id as string) || null;
            googleSaveUrl = (g.save_url as string) || (g.saveUrl as string) || (g.url as string) || null;
          }
          // Alternative flat fields
          if (!appleId && (passData as Record<string, unknown>).pass_id) {
            // fallback
          }
          passfastWarnings = (passData as Record<string, unknown>).warnings || null;

          const hasApple = Boolean(appleId && appleDownloadUrl);
          const hasGoogle = Boolean(googleId && googleSaveUrl);
          // If at least one wallet available, consider ready
          if (hasApple || hasGoogle) {
            walletStatus = "ready";
          } else {
            // No wallet but PassFast returned 200 — treat as error if no URLs
            // Check if response contains any success indicator
            const hasAny = Boolean(appleId || googleId || appleDownloadUrl || googleSaveUrl);
            walletStatus = hasAny ? "ready" : "error";
            if (walletStatus === "error") walletError = "PassFast não retornou credenciais";
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          console.warn("PassFast generate timeout", {
            duration_ms: Date.now() - startedAt,
          });
        }
        const msg = (e as Error).name === "AbortError" ? "PassFast timeout" : (e as Error).message;
        walletError = msg || "Falha ao gerar credencial";
        walletStatus = "error";
      }
    } else {
      walletError = "PassFast não configurado";
      walletStatus = "error";
    }

    // Update wallet fields — never fail the inscription if this update fails
    try {
      await supabase.from("event_registrations").update({
        passfast_apple_id: appleId,
        passfast_apple_download_url: appleDownloadUrl,
        passfast_google_id: googleId,
        passfast_google_save_url: googleSaveUrl,
        wallet_status: walletStatus,
        wallet_created_at: walletStatus === "ready" ? new Date().toISOString() : null,
        wallet_error: walletError,
      }).eq("id", registrationId);
    } catch (_e) {
      // silent — inscription already created
    }

    // Response to frontend — never expose hashes or CPF
    const response: Record<string, unknown> = {
      ok: true,
      id: registrationId,
      cpf_last4: data.cpf_last4,
      created_at: data.created_at,
      wallet_status: walletStatus,
    };

    if (walletStatus === "ready") {
      // Return wallet access token only once (opaque)
      response.wallet_access_token = walletAccessToken;
      response.wallet = {
        apple_available: Boolean(appleId && appleDownloadUrl),
        google_available: Boolean(googleId && googleSaveUrl),
        google_save_url: googleSaveUrl || null,
      };
      if (passfastWarnings) response.warnings = passfastWarnings;
    } else if (walletStatus === "error") {
      response.wallet_error = "Inscrição confirmada, mas não foi possível gerar sua credencial digital agora.";
      // Still return access token for potential retry via wallet endpoint? Return it so frontend can store
      response.wallet_access_token = walletAccessToken;
    }

    return json(response, 201, req);
  } catch (_err) {
    return json({ error: "Não foi possível concluir sua inscrição. Tente novamente." }, 500, req);
  }
});
