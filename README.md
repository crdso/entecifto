# ENTEC 2026 — site oficial

Repositório `crdso/entecifto` · domínio `https://entecifto.online` · Netlify + Supabase + Cloudflare R2.

O site anterior (React/Vite) está preservado na branch **`backup-entec-antiga-2026-09-26`**
(commit `a388747`), que é o ponto de rollback.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `site/` | Site público estático (tudo o que vai para o navegador) |
| `scripts/build.mjs` | Build: copia `site/` para `dist/`, gera `dist/env.js`, calcula a CSP e valida tudo |
| `netlify/functions/` | `foto.mjs` (`/api/foto`, download de 1 original) e `resultados.mjs` (`/api/resultados`) |
| `netlify/edge-functions/zip.js` | `/api/zip/*`: ZIP das fotos selecionadas, em streaming |
| `worker/` | Núcleo do ZIP (`src/zip-core.js`), manifesto das fotos e Worker Cloudflare alternativo |
| `supabase/` | Backend: Edge Functions, `config.toml` e SQL (tabelas, RLS) |
| `tools/` | Servidor local, importação da galeria para o R2 e padronização do `<head>` |

Rotas: `/`, `/sobre`, `/galeria`, `/certificado`, `/resultados`, `/privacidade`, `/admin`
(e `/inscricao` → `/certificado`, 301).

## Variáveis de ambiente

Mesmos nomes do site anterior. Na Netlify: *Site configuration → Environment variables*.
Localmente: arquivo `.env.local` (fora do Git).

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — somente a chave pública `anon`; o build recusa qualquer outra
- `VITE_ADMIN_EMAIL`

`.r2.env` (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_PUBLIC_URL`)
é só para as ferramentas locais (`tools/import_gallery.py`, `worker/build_manifest.py`) e nunca
vai para o site. Segredos das Edge Functions ficam no Supabase (*Edge Function Secrets*).

## Desenvolvimento

```bash
python tools/serve.py            # site/ em http://localhost:5173
node scripts/build.mjs           # build de produção em dist/
python tools/serve.py --dist     # dist/ com _headers (CSP) e _redirects aplicados
```

A porta 5173 é a liberada no CORS das Edge Functions do Supabase para desenvolvimento.
O `serve.py` gera `/env.js` a partir do `.env.local` e espelha `/api/foto`, `/api/resultados`
e `/api/zip/*`.

## Publicação

A Netlify roda `node scripts/build.mjs` e publica `dist/` (ver `netlify.toml`). O build falha se
faltar variável, se a chave não for `anon`, se houver link local quebrado, referência a
`localhost`/túnel no site, ou se o manifesto do ZIP não corresponder a `site/gallery.json`.

`_headers` define a CSP; os scripts inline são liberados por hash SHA-256 calculado no build.

## Galeria (R2)

`site/gallery.json` lista as 727 fotos do bucket `entec-galeria-2026` (URL pública r2.dev):
thumbnails na grade e no carrossel da home, originais no lightbox e nos downloads.

- Download individual: `/api/foto?id=<id>` → original com `Content-Disposition: attachment`.
- Download múltiplo: `POST /api/zip/prepare` com os ids → URL `/api/zip/<seleção>` que devolve
  `ENTEC-2026-XX-fotos.zip`. O ZIP usa STORE e o CRC32 já registrado no R2, repassando um original
  por vez (sem juntar tudo em memória). Só aceita ids do manifesto; máximo de 300 fotos.
- Nova importação: `python tools/import_gallery.py` e depois `python worker/build_manifest.py`
  (somente leitura no R2) para regenerar `worker/src/manifest.json`.

Alternativa ao Edge Function: `cd worker && npx wrangler deploy` publica o mesmo ZIP como Worker
com binding direto ao bucket R2 (rotas `/zip/*`). Não é necessário para o site funcionar.

## Supabase (projeto `pgebbwswxdjkormknnrg`)

Funções usadas pelo site: `event-certificate` (PDF do certificado), `event-results`,
`event-checkin`, `event-certificate-admin`, `event-wallet`, `track-visit`. As demais
(`event-register`, `create-payment`, `mp-*`, `cleanup-pending`) são da fase de inscrições/camisas.

O código em `supabase/functions/` corresponde ao que está publicado, com uma exceção:
`event-register` tem aqui o bloqueio por `event_settings.registrations_open`, que ainda não foi
publicado. `event-results` foi atualizado a partir da versão publicada (grupos reais, nota 0–100).

Publicação (mantém a configuração atual de JWT de cada função):

```bash
supabase functions deploy event-certificate --project-ref pgebbwswxdjkormknnrg
supabase functions deploy event-checkin event-certificate-admin --project-ref pgebbwswxdjkormknnrg
supabase functions deploy event-results event-wallet event-register track-visit cleanup-pending create-payment mp-webhook mp-verify --no-verify-jwt --project-ref pgebbwswxdjkormknnrg
```

`event-certificate` usa os assets de `functions/event-certificate/assets/` (modelo, fonte e
assinatura otimizada), declarados em `supabase/config.toml`.

## Admin

`/admin`: login Supabase restrito a `VITE_ADMIN_EMAIL` (conferido também nas Edge Functions via
`ADMIN_EMAIL`). Abas: Inscrições (camisas, financeiro, abrir/fechar inscrições, PDF), Participantes
(presença, credencial Wallet, certificado, ação em massa, credenciamento por QR, CSV), Visitas
(tempo real) e Resultados (notas e liberação do pódio). Nenhuma chave de serviço no navegador.
