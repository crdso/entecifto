// Download em ZIP das fotos selecionadas na /galeria, publicado junto com o site.
// Mesmo núcleo do Worker Cloudflare (worker/src/zip-core.js); aqui os originais vêm da URL
// pública do R2 (os mesmos arquivos de gallery.json), sem nenhuma credencial.
import { createZipHandler } from '../../worker/src/zip-core.js';

const R2_PUBLIC_BASE = 'https://pub-73a76ebfad354022a61b3486417cdbe4.r2.dev/';

const handle = createZipHandler({
  basePath: '/api/zip',
  async getOriginal(key) {
    const response = await fetch(R2_PUBLIC_BASE + key.split('/').map(encodeURIComponent).join('/'));
    if (!response.ok || !response.body) return null;
    return { size: Number(response.headers.get('content-length')), body: response.body };
  },
});

export default (request, context) => handle(request, context?.waitUntil?.bind(context));

export const config = { path: ['/api/zip/prepare', '/api/zip/*'] };
