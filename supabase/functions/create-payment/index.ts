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

// ===== Desconto de estudante =====
// E-mails elegíveis (parte local antes do "@"). O desconto só vale UMA vez
// por e-mail e apenas DEPOIS de um pagamento ser aprovado: enquanto não existir
// uma inscrição com status "pago" para o e-mail, o desconto é concedido (mesmo
// que o pagamento fique pendente e a pessoa tente de novo). Após aprovação,
// a próxima compra volta ao valor cheio.
const DISCOUNT_LOCAL_PARTS = [
  "abraao.lima2", "adrya.oliveira", "alexandre.fernandes2", "ana.rios2",
  "anna.lima5", "bianca.silva15", "brunno.oliveira4", "caio.moraes",
  "cassio.costa2", "claudio.cardoso", "danhyel.gomes", "daniele.santos2",
  "davi.pereira5", "denner.pontes", "eduarda.padilha", "eliaby.veloso",
  "ezequias.cardoso", "gabriel.sousa21", "gustavo.nascimento3", "hemilly.souza2",
  "hiago.sousa3", "jair.cavalcante", "jhonata.silva6", "juliana.lima3",
  "khalil.pellegrini", "laura.tundelo", "luis.santana", "luiz.fischer",
  "maria.lopes18", "maria.conceicao12", "matheus.gomes4", "rafysa.menezes",
  "sabrina.silva9", "thaylon.carvalho", "yuri.silva6",
];
const FULL_PRICE = 60;
const DISCOUNT_PRICE = 50;

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

    // Calcula o valor final: desconto só se o e-mail for elegível E ainda não
    // houver pagamento aprovado ("pago") para esse e-mail.
    const storedEmail = String(inscricao.email || "").trim();
    const emailLocal = storedEmail.toLowerCase().split("@")[0];
    let valor = Number(inscricao.valor) || FULL_PRICE;

    if (DISCOUNT_LOCAL_PARTS.includes(emailLocal)) {
      const { data: alreadyPaid } = await supabase
        .from("inscricoes")
        .select("id")
        .ilike("email", storedEmail)
        .eq("status", "pago")
        .limit(1);
      if (!alreadyPaid || alreadyPaid.length === 0) {
        valor = DISCOUNT_PRICE;
      }
    }

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
      .update({ payment_id: String(mpData.id), payment_status: "pending", valor })
      .eq("id", inscricao.id);

    return json({ checkoutUrl: mpData.init_point, preferenceId: mpData.id });
  } catch (err) {
    return json({ error: err.message || "Erro inesperado." }, 500);
  }
});
