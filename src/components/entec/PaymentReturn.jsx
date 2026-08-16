import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock3, XCircle, Loader2 } from "lucide-react";
import { callFunction } from "@/lib/supabase";
import { SUPABASE_CONFIGURED } from "@/lib/supabaseConfig";

const CONFIG = {
  approved: {
    icon: <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />,
    title: "Pagamento confirmado!",
    text: "Sua compra foi concluída. Sua camisa ENTEC 2026 está garantida — entraremos em contato para a entrega.",
    classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  },
  pending: {
    icon: <Clock3 className="h-6 w-6 text-amber-400 shrink-0" />,
    title: "Pagamento em análise",
    text: "Recebemos seu pedido. Assim que o pagamento for aprovado pelo Mercado Pago, confirmamos aqui.",
    classes: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  },
  failure: {
    icon: <XCircle className="h-6 w-6 text-red-400 shrink-0" />,
    title: "Pagamento não concluído",
    text: "Seu pagamento não foi concluído. Você pode tentar novamente pelo botão \"Adquira a sua!\".",
    classes: "border-red-500/40 bg-red-500/10 text-red-100",
  },
};

export default function PaymentReturn() {
  const [state, setState] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const paymentId = params.get("payment_id");

    // Só exibe algo se vier um payment_id real para verificar no Mercado Pago.
    // Digitar "/?payment=approved" sozinho não mostra nada.
    if (!paymentId) return;

    let cancelled = false;
    setChecking(true);

    const run = async () => {
      if (!SUPABASE_CONFIGURED) {
        if (cancelled) return;
        setChecking(false);
        return;
      }
      try {
        const data = await callFunction("mp-verify", { paymentId });
        if (cancelled) return;
        if (data.approved) {
          setState("approved");
        } else {
          setState(payment === "pending" ? "pending" : "failure");
        }
      } catch {
        // Sem resposta da verificação, não afirmamos que foi pago.
        if (cancelled) return;
        setState(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    run();

    // Limpa os parâmetros da URL para o aviso não repetir ao atualizar a página
    const url = new URL(window.location.href);
    ["payment", "payment_id", "status", "preference_id", "external_reference", "collection_id"].forEach((k) =>
      url.searchParams.delete(k)
    );
    window.history.replaceState({}, document.title, url.pathname + url.search);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  const cfg = CONFIG[state];
  return (
    <div className="relative z-40 mx-auto max-w-3xl px-5">
      <div className={`mt-24 flex items-start gap-3 rounded-2xl border px-4 py-3.5 backdrop-blur-md ${cfg.classes}`}>
        {cfg.icon}
        <div>
          <div className="font-semibold text-sm">{cfg.title}</div>
          <div className="mt-0.5 text-xs opacity-90 leading-relaxed">{cfg.text}</div>
        </div>
        {checking && state === "pending" && <Loader2 className="h-4 w-4 animate-spin ml-auto shrink-0" />}
      </div>
    </div>
  );
}