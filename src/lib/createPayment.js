// Cria a preferência de pagamento no Mercado Pago via Edge Function
// do Supabase (seguro: o Access Token do MP fica só no servidor).
import { callFunction } from "@/lib/supabase";
import { SUPABASE_CONFIGURED } from "@/lib/supabaseConfig";

export async function createPayment(inscricao) {
  if (!SUPABASE_CONFIGURED) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  const result = await callFunction("create-payment", {
    inscricaoId: inscricao.id,
    siteUrl,
  });

  return { checkoutUrl: result.checkoutUrl || null };
}
