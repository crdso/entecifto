import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED } from "@/lib/supabaseConfig";
import { supabase } from "@/lib/supabase";

// Registra a visita via Edge Function track-visit (sem bloquear a navegação).
// - Não conta quando o admin está logado (evita seu próprio acesso)
// - Supressão de duplicatas para StrictMode e navegação rápida
export default function VisitTracker() {
  const location = useLocation();
  const lastPath = useRef("");

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !SUPABASE_URL) return;
    const path = location.pathname + location.search;
    if (lastPath.current === path) return;
    lastPath.current = path;
    const timer = setTimeout(() => {
      lastPath.current = "";
    }, 2000);

    // Não conta acesso do admin logado
    supabase?.auth.getSession().then(({ data: { session } }) => {
      if (session) return;
      const payload = {
        path,
        referrer: document.referrer || null,
      };
      fetch(`${SUPABASE_URL}/functions/v1/track-visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
    });

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  return null;
}
