import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { SUPABASE_URL, SUPABASE_CONFIGURED } from "@/lib/supabaseConfig";

// Registra a visita via Edge Function track-visit (sem bloquear a navegação).
// Usa supressão de duplicatas para StrictMode e navegação rápida.
export default function VisitTracker() {
  const location = useLocation();
  const lastPath = useRef("");

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !SUPABASE_URL) return;
    const path = location.pathname + location.search;
    // evita duplicar o mesmo path em < 2s (StrictMode / HMR)
    if (lastPath.current === path) return;
    lastPath.current = path;
    const timer = setTimeout(() => {
      lastPath.current = "";
    }, 2000);

    const payload = {
      path,
      referrer: document.referrer || null,
    };

    // fire-and-forget — não aguarda resposta e ignora erros
    fetch(`${SUPABASE_URL}/functions/v1/track-visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  return null;
}
