// Worker Cloudflare do download em ZIP, ligado direto ao bucket R2 (binding GALERIA).
// Rotas: POST /zip/prepare e GET /zip/<seleção>. A lógica está em zip-core.js.
import { createZipHandler } from './zip-core.js';

export default {
  fetch(request, env, ctx) {
    const handle = createZipHandler({
      basePath: '/zip',
      maxPhotos: env.MAX_PHOTOS,
      getOriginal: (key) => env.GALERIA.get(key),
    });
    return handle(request, (job) => ctx.waitUntil(job));
  },
};
