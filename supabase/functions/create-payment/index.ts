// Cria a preferência de pagamento no Mercado Pago (Checkout Pro) e
// devolve o link (init_point) para redirecionar o comprador.
//
// Variáveis de ambiente (configure com: supabase secrets set NOME=valor):
//   MP_ACCESS_TOKEN          -> Access Token da sua conta Mercado Pago
//   SUPABASE_SERVICE_ROLE_KEY -> Service Role Key (Project Settings -> API)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (!MP_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      { error: "Função não configurada. Defina MP_ACCESS_TOKEN, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY." },
      500,
    );
  }

  try {
    const { inscricaoId, siteUrl } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: inscricao, error } = await supabase
      .from("inscricoes")
      .select("*")
      .eq("id", inscricaoId)
      .single();

    if (error || !inscricao) {
      return json({ error: "Inscrição não encontrada." }, 404);
    }

    const phoneDigits = String(inscricao.telefone || "").replace(/\D/g, "");
    const valor = Number(inscricao.valor || 60);

    // O Mercado Pago exige back_urls.success quando usa auto_return, mas
    // rejeita URLs de localhost. Em teste local, sem auto_return funciona.
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)/.test(siteUrl || "");

    const preference = {
      items: [
        {
          id: "camisa-entec-2026",
          title: "Camisa ENTEC 2026",
          description: "Camisa oficial do evento ENTEC 2026",
          quantity: 1,
          unit_price: valor,
          currency_id: "BRL",
        },
      ],
      payer: {
        name: inscricao.nome,
        email: inscricao.email,
        phone: phoneDigits.length >= 10
          ? { area_code: phoneDigits.slice(0, 2), number: phoneDigits.slice(2) }
          : undefined,
      },
      external_reference: String(inscricao.id),
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      back_urls: {
        success: `${siteUrl}/?payment=approved`,
        pending: `${siteUrl}/?payment=pending`,
        failure: `${siteUrl}/?payment=failure`,
      },
      auto_return: isLocalhost ? undefined : "approved",
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      return json({ error: mpData?.message || "Falha ao criar o pagamento no Mercado Pago." }, mpRes.status);
    }

    await supabase
      .from("inscricoes")
      .update({ payment_id: String(mpData.id), payment_status: "pending" })
      .eq("id", inscricao.id);

    return json({ checkoutUrl: mpData.init_point, preferenceId: mpData.id });
  } catch (err) {
    return json({ error: err.message || "Erro inesperado." }, 500);
  }
});
