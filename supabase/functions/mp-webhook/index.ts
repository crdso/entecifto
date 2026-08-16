// Webhook do Mercado Pago: o MP avisa quando o pagamento muda de status.
// Quando o status for "approved", a inscrição vira "pago" automaticamente.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const type = body?.type;
    const paymentId = body?.data?.id;

    // MP envia vários tipos; só queremos o de pagamento.
    if (type !== "payment" || !paymentId) {
      return new Response("ok");
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();

    if (payment?.status === "approved" && payment?.external_reference) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
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

    return new Response("ok");
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
