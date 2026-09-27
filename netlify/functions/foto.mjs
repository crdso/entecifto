// Download same-origin dos originais da galeria (R2 público, sem CORS/Content-Disposition).
// Recebe apenas o id de gallery.json: não é um proxy aberto e não usa credenciais.
let manifest;

async function loadManifest(request) {
  if (!manifest) {
    const response = await fetch(new URL('/gallery.json', request.url));
    if (!response.ok) throw new Error(`gallery.json: HTTP ${response.status}`);
    const photos = await response.json();
    manifest = new Map(photos.map(photo => [photo.id, photo]));
  }
  return manifest;
}

function contentDisposition(filename) {
  const fallback = filename.replace(/[^\w.()-]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export default async (request) => {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[a-f0-9]{64}$/.test(id)) return new Response('Foto inválida.', { status: 400 });

  let photo;
  try {
    photo = (await loadManifest(request)).get(id);
  } catch {
    manifest = undefined;
    return new Response('Acervo indisponível.', { status: 502 });
  }
  if (!photo) return new Response('Foto não encontrada.', { status: 404 });

  const upstream = await fetch(photo.original);
  if (!upstream.ok || !upstream.body) {
    return new Response('Não foi possível obter o original.', { status: upstream.status === 404 ? 404 : 502 });
  }
  const headers = new Headers({
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Content-Disposition': contentDisposition(photo.filename),
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);
  return new Response(upstream.body, { headers });
};

export const config = { path: '/api/foto' };
