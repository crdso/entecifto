// Verifica o status de um pagamento no Mercado Pago. Usado quando o
// comprador volta para o site (fallback caso o webhook ainda não tenha chegado).
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

async function confirmarPagamento(supabase, payment) {
  await supabase
    .from("inscricoes")
    .update({
      status: "pago",
      payment_id: String(payment.id),
      payment_status: "approved",
      payment_method: payment.payment_method_id || null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", payment.external_reference);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const { paymentId } = await req.json();
    if (!paymentId) {
      return json({ approved: false, status: "no_payment_id" });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();

    if (payment?.status === "approved" && payment?.external_reference) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      await confirmarPagamento(supabase, payment);
      return json({ approved: true, status: payment.status });
    }

    return json({ approved: false, status: payment?.status || "unknown" });
  } catch (err) {
    return json({ error: err.message || "Erro inesperado." }, 500);
  }
});
