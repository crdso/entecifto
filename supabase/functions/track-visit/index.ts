// Registra cada acesso ao site para o painel de monitoramento do admin.
// Extrai IP real priorizando headers do Netlify/Cloudflare e filtra bots.
//
// Variáveis de ambiente (já configuradas no projeto Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isPrivateIp(ip: string): boolean {
  const v = ip.trim();
  if (v === "::1" || v === "127.0.0.1" || v.startsWith("::ffff:127.")) return true;
  if (v.startsWith("10.") || v.startsWith("192.168.") || v.startsWith("fc") || v.startsWith("fe80:")) return true;
  if (v.startsWith("172.")) {
    const n = parseInt(v.split(".")[1] || "0", 10);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function clientIp(req: Request): string | null {
  const h = (name: string) => req.headers.get(name) || req.headers.get(name.toLowerCase());
  // Prioridade: headers específicos de proxy (Netlify, Cloudflare)
  for (const name of ["x-nf-client-connection-ip", "cf-connecting-ip", "x-real-ip", "x-client-ip"]) {
    const v = h(name);
    if (v) return v.split(",")[0].trim();
  }
  const xff = h("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // pega o primeiro IP público; se todos forem privados, pega o primeiro
    for (const p of parts) if (!isPrivateIp(p)) return p;
    return parts[0] || null;
  }
  return null;
}

const BOT_RE = /bot|crawler|spider|crawling|googlebot|bingbot|yahoo|yandex|facebookexternalhit|slurp|mediapartners|baidu|semrush|ahrefs|petalbot|bytespider|applebot|linkedinbot|embedly|quora|outbrain|pinterest|slackbot|twitterbot|whatsapp|telegrambot|discordbot/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Função não configurada." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const path = typeof body.path === "string" ? body.path.slice(0, 500) : "/";
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 1000) : null;

    const ip = clientIp(req);
    const userAgent = req.headers.get("user-agent")?.slice(0, 1000) || null;

    // Ignora bots/crawlers (não poluem o painel)
    if (userAgent && BOT_RE.test(userAgent)) {
      return new Response(JSON.stringify({ ok: true, ignored: "bot" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Dedup: mesmo IP + mesmo path nos últimos 5 minutos não conta de novo (evita reloads)
    if (ip) {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("visitas")
        .select("id")
        .eq("ip", ip)
        .eq("path", path)
        .gte("created_at", since)
        .limit(1);
      if (recent && recent.length > 0) {
        return new Response(JSON.stringify({ ok: true, dedup: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await supabase.from("visitas").insert({
      path,
      ip,
      user_agent: userAgent,
      referrer: referrer || null,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Erro inesperado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
