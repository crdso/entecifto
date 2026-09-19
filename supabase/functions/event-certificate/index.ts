// Event Certificate — ENTEC 2026
// POST { cpf, birthDate } -> PDF if attendance_confirmed && certificate_ready
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EVENT_REGISTRATION_SECRET
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EVENT_REGISTRATION_SECRET = Deno.env.get("EVENT_REGISTRATION_SECRET");

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
  // else no header (not in allowlist)
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
  return headers;
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

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "participante";
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EVENT_REGISTRATION_SECRET) {
    return new Response(JSON.stringify({ error: "Função não configurada." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Payload inválido." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const rawCpf = String((body as Record<string, unknown>).cpf || "").trim();
  const birthDateRaw = String((body as Record<string, unknown>).birthDate || (body as Record<string, unknown>).birth_date || (body as Record<string, unknown>).nascimento || "").trim();

  const cpfDigits = rawCpf.replace(/\D/g, "");
  if (cpfDigits.length !== 11 || !isValidCPF(cpfDigits)) {
    // Generic message to avoid distinguishing
    return new Response(JSON.stringify({ error: "Não encontramos uma participação com esses dados." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!birthDateRaw) {
    return new Response(JSON.stringify({ error: "Não encontramos uma participação com esses dados." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const birthDateObj = new Date(birthDateRaw);
  if (Number.isNaN(birthDateObj.getTime())) {
    return new Response(JSON.stringify({ error: "Não encontramos uma participação com esses dados." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const isoBirth = birthDateObj.toISOString().slice(0, 10);

  const lookupHash = await hmacHex(EVENT_REGISTRATION_SECRET, `${cpfDigits}|${isoBirth}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: reg, error: fetchErr } = await supabase.from("event_registrations").select("id, name, attendance_confirmed, certificate_ready").eq("lookup_hash", lookupHash).single();

  if (fetchErr || !reg) {
    return new Response(JSON.stringify({ error: "Não encontramos uma participação com esses dados." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!(reg as Record<string, unknown>).attendance_confirmed) {
    return new Response(JSON.stringify({ error: "Não há presença confirmada para esta participação." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!(reg as Record<string, unknown>).certificate_ready) {
    return new Response(JSON.stringify({ error: "Seu certificado ainda não foi liberado." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const rawName = String((reg as Record<string, unknown>).name || "").trim();
  if (!rawName) {
    return new Response(JSON.stringify({ error: "Não foi possível gerar o certificado agora. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const name = rawName.toUpperCase();

  // Generate PDF — A4 horizontal, template 3000×2121 cobre página toda, nome calibrado visualmente
  try {
    const templateBytes = await Deno.readFile(new URL("./assets/CERTIFICADO.jpg", import.meta.url));
    const fontBytes = await Deno.readFile(new URL("./assets/AbrilFatface-Regular.ttf", import.meta.url));

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const templateImage = templateBytes[0] === 0xFF && templateBytes[1] === 0xD8
      ? await pdfDoc.embedJpg(templateBytes)
      : await pdfDoc.embedPng(templateBytes);
    const font = await pdfDoc.embedFont(fontBytes);

    // A4 horizontal
    const PAGE_WIDTH = 841.89;
    const PAGE_HEIGHT = 595.28;
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    page.drawImage(templateImage, {
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });

    // Posição calibrada visualmente com o template oficial — 47,3% da altura a partir da base
    const NAME_CENTER_Y_RATIO = 0.473;
    const pageWidth = PAGE_WIDTH;
    const pageHeight = PAGE_HEIGHT;

    const MAX_NAME_WIDTH_CM = 18.62;
    const MAX_NAME_WIDTH_PT = MAX_NAME_WIDTH_CM * 28.3464567;
    const CANVA_BASE_FONT_SIZE = 28;
    const MAX_FONT_SIZE = 30;
    const MIN_FONT_SIZE = 13;
    let fontSize = CANVA_BASE_FONT_SIZE;
    if (fontSize > MAX_FONT_SIZE) fontSize = MAX_FONT_SIZE;

    let textWidth = font.widthOfTextAtSize(name, fontSize);
    while (textWidth > MAX_NAME_WIDTH_PT && fontSize > MIN_FONT_SIZE) {
      fontSize -= 0.5;
      textWidth = font.widthOfTextAtSize(name, fontSize);
    }
    if (fontSize < MIN_FONT_SIZE) fontSize = MIN_FONT_SIZE;

    const textHeight = font.heightAtSize(fontSize);
    const x = (pageWidth - textWidth) / 2;
    const y = pageHeight * NAME_CENTER_Y_RATIO - textHeight / 2;

    page.drawText(name, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(1, 1, 1),
    });

    const pdfBytes = await pdfDoc.save();

    const safeName = sanitizeFilename(name);
    const filename = `certificado-entec-2026-${safeName}.pdf`;

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (e) {
    console.error("PDF generation error", e);
    return new Response(JSON.stringify({ error: "Não foi possível gerar o certificado agora. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
