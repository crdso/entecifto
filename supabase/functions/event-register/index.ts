// ENTEC 2026 — Inscrição segura do evento
// Variáveis de ambiente (configure com: supabase secrets set EVENT_REGISTRATION_SECRET=...):
//   EVENT_REGISTRATION_SECRET  -> chave HMAC-SHA256 (nunca expor no frontend)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EVENT_REGISTRATION_SECRET = Deno.env.get("EVENT_REGISTRATION_SECRET");

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
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    allowOrigin = origin;
  } else if (origin && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
    allowOrigin = origin;
  } else if (origin === "") {
    allowOrigin = "*";
  } else {
    // fallback restrito
    allowOrigin = "https://entecifto.online";
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, req?: Request) {
  const headers = req ? getCorsHeaders(req) : { "Access-Control-Allow-Origin": "*" , "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405, req);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVENT_REGISTRATION_SECRET) {
    return json({ error: "Função não configurada." }, 500, req);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Payload inválido." }, 400, req);
    }
    const rawName = typeof (body as Record<string, unknown>).name === "string" ? (body as Record<string, unknown>).name as string : "";
    const rawCpf = typeof (body as Record<string, unknown>).cpf === "string" ? (body as Record<string, unknown>).cpf as string : "";
    const rawBirth = typeof (body as Record<string, unknown>).birthDate === "string"
      ? (body as Record<string, unknown>).birthDate as string
      : typeof (body as Record<string, unknown>).birth_date === "string"
      ? (body as Record<string, unknown>).birth_date as string
      : typeof (body as Record<string, unknown>).nascimento === "string"
      ? (body as Record<string, unknown>).nascimento as string
      : "";
    const rawEmail = typeof (body as Record<string, unknown>).email === "string" ? (body as Record<string, unknown>).email as string : "";

    // Normalizações
    const name = rawName.trim().replace(/\s+/g, " ");
    const cpfDigits = rawCpf.replace(/\D/g, "");
    const email = rawEmail.trim().toLowerCase();
    const birthDateRaw = rawBirth.trim();

    // Validações server-side
    if (name.length < 3) {
      return json({ error: "Informe um nome válido." }, 400, req);
    }
    if (name.length > 120) {
      return json({ error: "Nome muito longo." }, 400, req);
    }
    if (!email || !isValidEmail(email)) {
      return json({ error: "Informe um e-mail válido." }, 400, req);
    }
    if (cpfDigits.length !== 11) {
      return json({ error: "Informe um CPF válido." }, 400, req);
    }
    if (!isValidCPF(cpfDigits)) {
      return json({ error: "Informe um CPF válido." }, 400, req);
    }
    if (!birthDateRaw) {
      return json({ error: "Informe sua data de nascimento." }, 400, req);
    }
    // birthDate deve ser ISO YYYY-MM-DD
    const birthDateObj = new Date(birthDateRaw);
    if (Number.isNaN(birthDateObj.getTime())) {
      return json({ error: "Data de nascimento inválida." }, 400, req);
    }
    // Normaliza para YYYY-MM-DD
    const isoBirth = birthDateObj.toISOString().slice(0, 10);
    // Verifica se data não é futura (comparando em UTC)
    const todayIso = new Date().toISOString().slice(0, 10);
    if (isoBirth > todayIso) {
      return json({ error: "Data de nascimento não pode ser no futuro." }, 400, req);
    }
    if (isoBirth < "1900-01-01") {
      return json({ error: "Data de nascimento inválida." }, 400, req);
    }

    const cpfLast4 = cpfDigits.slice(-4);
    const cpfHash = await hmacHex(EVENT_REGISTRATION_SECRET, cpfDigits);
    const lookupHash = await hmacHex(EVENT_REGISTRATION_SECRET, `${cpfDigits}|${isoBirth}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("event_registrations")
      .insert({
        name,
        email,
        cpf_hash: cpfHash,
        cpf_last4: cpfLast4,
        lookup_hash: lookupHash,
      })
      .select("id, cpf_last4, created_at")
      .single();

    if (error) {
      // Duplicidade (unique violation)
      const msg = (error.message || "").toLowerCase();
      const code = (error as Record<string, unknown>).code as string | undefined;
      if (code === "23505" || msg.includes("duplicate") || msg.includes("unique") || msg.includes("cpf_hash") || msg.includes("lookup_hash")) {
        return json({ error: "Já existe uma inscrição vinculada a este CPF." }, 409, req);
      }
      // Não expor detalhes internos
      return json({ error: "Não foi possível concluir sua inscrição. Tente novamente." }, 500, req);
    }

    return json(
      {
        ok: true,
        id: data.id,
        cpf_last4: data.cpf_last4,
        created_at: data.created_at,
      },
      201,
      req,
    );
  } catch (_err) {
    return json({ error: "Não foi possível concluir sua inscrição. Tente novamente." }, 500, req);
  }
});
