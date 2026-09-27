// Build de produção do site ENTEC: copia site/ para dist/, gera dist/env.js a partir das
// variáveis VITE_* (mesmos nomes do site anterior) e valida o resultado antes da publicação.
// Uso: node scripts/build.mjs   (na Netlify: comando de build definido em netlify.toml)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const DIST = join(ROOT, 'dist');
const errors = [];
const fail = (message) => errors.push(message);

// ------------------------------------------------------------------ Variáveis
function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !line.trimStart().startsWith('#')) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}
const local = readEnvFile(join(ROOT, '.env.local'));
const env = Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_ADMIN_EMAIL']
  .map((name) => [name, (process.env[name] || local[name] || '').trim()]));
for (const [name, value] of Object.entries(env)) if (!value) fail(`Variável ${name} não definida (painel da Netlify ou .env.local).`);
if (env.VITE_SUPABASE_URL && !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(env.VITE_SUPABASE_URL)) fail('VITE_SUPABASE_URL não parece uma URL de projeto Supabase.');
if (env.VITE_SUPABASE_ANON_KEY) {
  try {
    const payload = JSON.parse(Buffer.from(env.VITE_SUPABASE_ANON_KEY.split('.')[1], 'base64url').toString('utf8'));
    // Nunca publicar outra chave que não a pública (anon).
    if (payload.role !== 'anon') fail(`VITE_SUPABASE_ANON_KEY tem papel "${payload.role}"; só a chave anon pode ir para o navegador.`);
    const ref = env.VITE_SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\./)?.[1];
    if (ref && payload.ref && payload.ref !== ref) fail('VITE_SUPABASE_ANON_KEY pertence a outro projeto Supabase.');
  } catch {
    fail('VITE_SUPABASE_ANON_KEY não é um JWT válido.');
  }
}
if (env.VITE_ADMIN_EMAIL && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.VITE_ADMIN_EMAIL)) fail('VITE_ADMIN_EMAIL não é um e-mail válido.');

// ------------------------------------------------------------------ Cópia
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(SITE, DIST, { recursive: true, filter: (src) => !src.split(sep).some((part) => part.startsWith('.')) });
writeFileSync(join(DIST, 'env.js'),
  '// Gerado no build a partir de VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_ADMIN_EMAIL.\n'
  + `export const SUPABASE_URL = ${JSON.stringify(env.VITE_SUPABASE_URL.replace(/\/+$/, ''))};\n`
  + `export const SUPABASE_ANON_KEY = ${JSON.stringify(env.VITE_SUPABASE_ANON_KEY)};\n`
  + `export const ADMIN_EMAIL = ${JSON.stringify(env.VITE_ADMIN_EMAIL)};\n`);

// ------------------------------------------------------------------ CSP
// Libera na CSP somente os scripts inline existentes (hash SHA-256), sem 'unsafe-inline'.
{
  const hashes = new Set();
  (function collect(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) collect(full);
      else if (name.endsWith('.html')) {
        for (const [, attrs, code] of readFileSync(full, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
          if (/\bsrc=/i.test(attrs) || !code.trim()) continue;
          hashes.add(`'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`);
        }
      }
    }
  })(DIST);
  const headersFile = join(DIST, '_headers');
  const headers = readFileSync(headersFile, 'utf8');
  if (!headers.includes('__INLINE_SCRIPT_HASHES__')) fail('_headers sem o marcador __INLINE_SCRIPT_HASHES__.');
  writeFileSync(headersFile, headers.replace('__INLINE_SCRIPT_HASHES__', [...hashes].sort().join(' ')));
}

// ------------------------------------------------------------------ Validações
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full); else files.push(full);
  }
})(DIST);
const rel = (file) => relative(DIST, file).split(sep).join('/');
const has = (path) => {
  const clean = decodeURIComponent(path.split(/[?#]/)[0]).replace(/^\/+/, '');
  const full = join(DIST, ...clean.split('/'));
  return (existsSync(full) && statSync(full).isFile()) || existsSync(join(full, 'index.html'));
};
const ROUTES = new Set(['/api/foto', '/api/resultados', '/api/zip/prepare']);
const external = (ref) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:)/i.test(ref) || ref === '' || ref.includes('${');

function checkRef(from, ref, base) {
  if (external(ref)) return;
  const path = ref.split(/[?#]/)[0];
  if (!path || ROUTES.has(path) || path.startsWith('/api/zip/')) return;
  const target = path.startsWith('/') ? path : posix.join(base, path);
  if (!has(target)) fail(`${from}: referência quebrada "${ref}"`);
}

const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.xml', '.txt', '.webmanifest']);
const FORBIDDEN = [/localhost/i, /127\.0\.0\.1/, /trycloudflare/i, /service_role/, /R2_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID/, /\.r2\.env/];
// O runtime do Framer contém URLs internas próprias; só páginas e scripts do site são checados.
const IGNORE_FORBIDDEN = (path) => path.startsWith('_framer/') || path.startsWith('admin/vendor/');

for (const file of files) {
  const path = rel(file);
  const ext = extname(file).toLowerCase();
  if (!TEXT.has(ext)) continue;
  const text = readFileSync(file, 'utf8');
  if (!IGNORE_FORBIDDEN(path)) for (const pattern of FORBIDDEN) if (pattern.test(text)) fail(`${path}: contém "${text.match(pattern)[0]}"`);
  const dir = '/' + posix.dirname(path).replace(/^\.$/, '');
  if (ext === '.html') {
    const base = (text.match(/<base\s+href="([^"]+)"/i)?.[1] || dir).replace(/\/?$/, '/');
    for (const [, ref] of text.matchAll(/\s(?:src|href)="([^"]+)"/g)) checkRef(path, ref, ref.startsWith('/') ? '/' : base);
    for (const [, ref] of text.matchAll(/url\(([^)'"]+)\)/g)) checkRef(path, ref, '/');
    if (!/<title>[^<]+<\/title>/.test(text)) fail(`${path}: sem <title>`);
    if (!text.includes('href="/favicon.ico"')) fail(`${path}: sem favicon`);
  } else if (ext === '.css') {
    for (const [, ref] of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) checkRef(path, ref, dir);
  } else if (ext === '.js' || ext === '.mjs') {
    for (const [, ref] of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"`]([./][^'"`]+)['"`]/g)) checkRef(path, ref, dir);
    // Assets capturados usados pelos módulos do Framer são relativos à raiz do site.
    for (const [, ref] of text.matchAll(/\.\/(assets\/captured\/[^'"`\s)]+?\.(?:woff2?|png|jpe?g|svg|webp))/g)) checkRef(path, '/' + ref, '/');
  }
}

for (const required of ['index.html', '404.html', 'sobre/index.html', 'galeria/index.html', 'certificado/index.html',
  'resultados/index.html', 'privacidade/index.html', 'admin/index.html', 'favicon.ico', 'favicon-32.png', 'favicon-192.png',
  'favicon-512.png', 'apple-touch-icon.png', 'manifest.json', 'robots.txt', 'sitemap.xml', 'og-entec-2026.jpg',
  '_headers', '_redirects', 'env.js', 'gallery.json']) if (!existsSync(join(DIST, required))) fail(`arquivo obrigatório ausente: ${required}`);

// Galeria e manifesto do ZIP precisam descrever as mesmas fotos, na mesma ordem.
const gallery = JSON.parse(readFileSync(join(DIST, 'gallery.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'worker', 'src', 'manifest.json'), 'utf8'));
const version = createHash('sha256').update(gallery.map((photo) => photo.id).join('\n')).digest('hex').slice(0, 12);
if (version !== manifest.version || manifest.photos.length !== gallery.length) fail('worker/src/manifest.json desatualizado: rode worker/build_manifest.py.');
if (gallery.some((photo) => !photo.thumbnail.includes('/thumbs/') || !photo.original.includes('/originals/'))) fail('gallery.json com thumbnail/original fora do padrão.');

if (errors.length) {
  console.error(`Build reprovado (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Build aprovado: ${files.length} arquivos em dist/ · ${gallery.length} fotos · manifesto ${manifest.version}`);
