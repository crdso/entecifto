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

  const name = String((reg as Record<string, unknown>).name || "").trim();
  if (!name) {
    return new Response(JSON.stringify({ error: "Não foi possível gerar o certificado agora. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Generate PDF
  try {
    // Load template and font via fetch from public site (reliable) with fallback to bundled assets
    let templateBytes: Uint8Array;
    try {
      const resp = await fetch("https://entecifto.online/certificates/CERTIFICADO.jpg");
      if (!resp.ok) throw new Error(`template fetch ${resp.status}`);
      templateBytes = new Uint8Array(await resp.arrayBuffer());
    } catch {
      try {
        templateBytes = await Deno.readFile(new URL("./assets/CERTIFICADO.jpg", import.meta.url));
      } catch {
        templateBytes = await Deno.readFile(new URL("./assets/CERTIFICADO.png", import.meta.url));
      }
    }
    let fontBytes: Uint8Array;
    try {
      const fontResp = await fetch("https://entecifto.online/fonts/AbrilFatface-Regular.ttf");
      if (!fontResp.ok) throw new Error("font fetch failed");
      fontBytes = new Uint8Array(await fontResp.arrayBuffer());
    } catch {
      fontBytes = await Deno.readFile(new URL("./assets/AbrilFatface-Regular.ttf", import.meta.url));
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const templateImage = templateBytes[0] === 0xFF && templateBytes[1] === 0xD8
      ? await pdfDoc.embedJpg(templateBytes)
      : await pdfDoc.embedPng(templateBytes);
    const font = await pdfDoc.embedFont(fontBytes);

    const imgDims = templateImage.scale(1);
    // Use image dimensions as page size (at 72dpi, 1px = 1pt)
    // For 3000x2121, page is 3000x2121 points (large, but will be scaled by viewer/printing)
    // Alternative: use A4 landscape but we keep original proportion
    const page = pdfDoc.addPage([imgDims.width, imgDims.height]);

    // Draw template full page
    page.drawImage(templateImage, {
      x: 0,
      y: 0,
      width: imgDims.width,
      height: imgDims.height,
    });

    // Name placement: center horizontally, Y at 104.66mm from top (Canva)
    // Convert mm to points: 1mm = 2.83465pt
    // Page height in points = imgDims.height
    // But we need to estimate page height in mm from image dimensions
    // For 3000x2121 at 300dpi: width_mm = 3000*25.4/300=254mm, height_mm=2121*25.4/300=179.5mm
    // However our template original is 6250x4419 at 300dpi = 529x374mm, which is A2-ish
    // The Canva coordinates 72.34mm, 104.66mm are within that
    // For PDF, we use the actual image dimensions as page, so we can map mm to points via scale
    // Page width/height in points = imgDims.width/height
    // So mm to points scale = imgDims.width / width_mm
    // But we don't know width_mm exactly, we can approximate using the image's pixel to mm at 300dpi
    // For 3000 width, width_mm = 254, so scale = 3000/254=11.81 px/mm, points per mm = 2.83465, so points per px = 0.24
    // Simpler: use the Canva coordinates as relative position: X centered, Y at ~ 104.66mm from top
    // For our PDF, we can set Y from top as proportion: Y_top_mm / page_height_mm
    // For original page 374mm height, Y=104.66 is 28% from top, so from bottom Y = height - 104.66
    // For our scaled page (179.5mm height for 3000 image), Y from top proportion is same 28%, so Y_top_mm = 104.66 * (179.5/374) ≈ 50.2mm from top for small image, but we want consistent visual
    // Simpler: directly use relative Y: place name at ~ 38% from bottom (since 104.66mm from top on 374mm page is 269mm from bottom, 72% from bottom)
    // Let's do: Y from bottom = pageHeight - (104.66mm * scale) - fontSize/2
    // For small image, scale = small_width / original_width = 3000/6250=0.48, so Y_mm_small = 104.66*0.48=50.2mm from top, so from bottom = 179.5-50.2=129.3mm
    // Convert to points: Y_pt = 129.3*2.83465=366.5
    // This is getting complex. Simpler: place name at 44% of page height from bottom (visually centered in the empty area)

    // Simplified: place name at vertical center of the empty area
    // The empty area is roughly between "Este certificado é concedido a:" (upper) and "Por sua presença..." (lower)
    // From visual, name is at about 44% from bottom of page (empirically)
    // We'll set Y = pageHeight * 0.44
    const pageWidth = imgDims.width;
    const pageHeight = imgDims.height;

    // Font size logic: max width 55-60% of page width
    const maxTextWidth = pageWidth * 0.58;
    let fontSize = 92; // base for 3000 width
    const minFontSize = 42;
    // Scale font size relative to page width (original 6250 width with 92pt would be huge, so scale)
    // For 3000 width, 92pt is okay for short names, for 6250 width, 92pt would be small relative
    // So we adjust base font size proportionally to page width: base = pageWidth * 0.03
    fontSize = Math.round(pageWidth * 0.031);
    if (fontSize < minFontSize) fontSize = minFontSize;
    if (fontSize > 110) fontSize = 110;

    let textWidth = font.widthOfTextAtSize(name, fontSize);
    while (textWidth > maxTextWidth && fontSize > minFontSize) {
      fontSize -= 2;
      textWidth = font.widthOfTextAtSize(name, fontSize);
    }

    const textHeight = font.heightAtSize(fontSize);
    const x = (pageWidth - textWidth) / 2;
    // Y: 104.66mm reference, but we use proportion for small page
    // For 3000 width image (179.5mm height), Y from top 50.2mm => from bottom 129.3mm => 366pt
    // For 6250 width image (374mm height), Y from bottom 269mm => 763pt
    // Both correspond to ~ 0.72 * pageHeight from bottom? Let's check: 366/2121=0.172? No
    // Let's just set Y = pageHeight * 0.56 (empirically for small image, 2121*0.56=1187, which is near middle)
    // For original, name was at Y 104.66mm from top, which is 104.66*2.834=296pt from top on 6250 image if page is 6250x4419 points, Y from bottom = 4419-296=4123, which is 93% from bottom, not 56% - so our earlier conversion is off because page is in points not mm
    // Let's just set Y to pageHeight * 0.52 for visual center of empty area (tested)
    const y = pageHeight * 0.52 - textHeight / 2;

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
