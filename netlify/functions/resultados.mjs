// Resultado público dos stands, servido na mesma origem do site.
// A função event-results só libera CORS para o domínio oficial e o ambiente local; este repasse
// evita o bloqueio em outros domínios. Encaminha apenas a ação pública "public_status".
// Mesmas variáveis do site (cadastradas no painel da Netlify).
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

export default async (request) => {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Método não permitido.', { status: 405 });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Response.json({ error: 'Serviço de resultados não configurado.' }, { status: 503 });
  }
  try {
    const upstream = await fetch(`${SUPABASE_URL}/functions/v1/event-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action: 'public_status' }),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Serviço de resultados indisponível.' }, { status: 502 });
  }
};

export const config = { path: '/api/resultados' };
