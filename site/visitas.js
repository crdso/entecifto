// Registro de acesso (Edge Function track-visit), como o VisitTracker do site anterior:
// envia só caminho e origem; IP e navegador são lidos pelo servidor. Alimenta a aba
// "Visitas" do /admin. Não conta o admin logado nem acessos fora do domínio oficial.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/env.js';

const PRODUCTION_HOSTS = ['entecifto.online', 'www.entecifto.online'];

function adminSignedIn() {
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    return Boolean(localStorage.getItem(`sb-${ref}-auth-token`));
  } catch {
    return false;
  }
}

if (SUPABASE_URL && SUPABASE_ANON_KEY && PRODUCTION_HOSTS.includes(location.hostname) && !adminSignedIn()) {
  fetch(`${SUPABASE_URL}/functions/v1/track-visit`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ path: location.pathname + location.search, referrer: document.referrer || null }),
  }).catch(() => {});
}
