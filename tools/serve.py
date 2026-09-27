"""Servidor de desenvolvimento do ENTEC: python tools/serve.py [porta] [--dist]  (padrão 5173)

--dist: serve o build de produção (dist/) aplicando _headers (CSP) e _redirects, como a Netlify.

Serve a pasta site/ com as mesmas rotas da produção:
- páginas sem barra final (/galeria -> site/galeria/index.html) e 404.html;
- /env.js gerado das variáveis VITE_* (.env.local ou ambiente), como no build;
- espelhos locais de /api/foto e /api/resultados (Netlify Functions) e /api/zip/* (Edge Function).
A porta 5173 é a liberada no CORS das Edge Functions do Supabase para desenvolvimento.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlsplit
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import base64, json, os, re, shutil, struct, sys, time

ROOT = Path(__file__).resolve().parent.parent
ARGS = [arg for arg in sys.argv[1:] if not arg.startswith('--')]
DIST_MODE = '--dist' in sys.argv
SITE = ROOT / ('dist' if DIST_MODE else 'site')
ENV_NAMES = ('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_ADMIN_EMAIL')
MAX_ZIP_PHOTOS = 300
_gallery = None
_manifest = None

def site_env():
    """Mesma regra de scripts/build.mjs: o ambiente tem prioridade sobre .env.local."""
    values = {}
    env_file = ROOT / '.env.local'
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                name, value = line.split('=', 1)
                values[name.strip()] = value.strip().strip('"').strip("'")
    return {name: os.environ.get(name) or values.get(name, '') for name in ENV_NAMES}

def env_module():
    env = site_env()
    return ('// Gerado a partir de VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_ADMIN_EMAIL.\n'
            f"export const SUPABASE_URL = {json.dumps(env['VITE_SUPABASE_URL'].rstrip('/'))};\n"
            f"export const SUPABASE_ANON_KEY = {json.dumps(env['VITE_SUPABASE_ANON_KEY'])};\n"
            f"export const ADMIN_EMAIL = {json.dumps(env['VITE_ADMIN_EMAIL'].strip())};\n")

def gallery():
    """gallery.json indexado por id (mesma regra da função Netlify /api/foto)."""
    global _gallery
    if _gallery is None:
        photos = json.loads((SITE / 'gallery.json').read_text(encoding='utf-8'))
        _gallery = {photo['id']: photo for photo in photos}
    return _gallery

def manifest():
    """worker/src/manifest.json: mesma lista (id, nome, tamanho, CRC32) do núcleo do ZIP."""
    global _manifest
    if _manifest is None:
        data = json.loads((ROOT / 'worker' / 'src' / 'manifest.json').read_text(encoding='utf-8'))
        data['index'] = {photo[0]: i for i, photo in enumerate(data['photos'])}
        _manifest = data
    return _manifest

def encode_selection(indices, total):
    bitmap = bytearray((total + 7) // 8)
    for i in indices:
        bitmap[i >> 3] |= 1 << (i & 7)
    return base64.urlsafe_b64encode(bytes(bitmap)).decode().rstrip('=')

def decode_selection(token, total):
    if not re.fullmatch(r'[A-Za-z0-9_-]+', token):
        return None
    try:
        bitmap = base64.urlsafe_b64decode(token + '=' * (-len(token) % 4))
    except ValueError:
        return None
    if len(bitmap) != (total + 7) // 8:
        return None
    return [i for i in range(total) if bitmap[i >> 3] & (1 << (i & 7))]

def zip_plan(photos, indices):
    """Cabeçalhos do ZIP (STORE, UTF-8, CRC do manifesto); espelha zipPlan do Worker."""
    now = time.localtime()
    dos_time = (now.tm_hour << 11) | (now.tm_min << 5) | (now.tm_sec // 2)
    dos_date = ((now.tm_year - 1980) << 9) | (now.tm_mon << 5) | now.tm_mday
    entries, central, offset = [], [], 0
    for i in indices:
        photo_id, name, size, crc = photos[i]
        raw = name.encode('utf-8')
        local = struct.pack('<IHHHHHIIIHH', 0x04034b50, 20, 0x0800, 0, dos_time, dos_date, crc, size, size, len(raw), 0) + raw
        central.append(struct.pack('<IHHHHHHIIIHHHHHII', 0x02014b50, 20, 20, 0x0800, 0, dos_time, dos_date, crc, size, size, len(raw), 0, 0, 0, 0, 0, offset) + raw)
        entries.append((photo_id, name, size, local))
        offset += len(local) + size
    central_bytes = b''.join(central)
    trailer = central_bytes + struct.pack('<IHHHHIIH', 0x06054b50, 0, 0, len(entries), len(entries), len(central_bytes), offset, 0)
    return entries, trailer, offset + len(trailer)

def netlify_rules(name):
    """Lê dist/_headers ou dist/_redirects (formato Netlify simplificado)."""
    file = SITE / name
    if not DIST_MODE or not file.exists():
        return []
    rules, current = [], None
    for line in file.read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if name == '_redirects':
            source, target, status = line.split()[:3]
            rules.append((source, target, int(status)))
        elif not line.startswith(' '):
            current = (line.strip(), [])
            rules.append(current)
        else:
            key, value = line.strip().split(':', 1)
            current[1].append((key.strip(), value.strip()))
    return rules

def matches(pattern, path):
    return path == pattern or (pattern.endswith('/*') and path.startswith(pattern[:-1]))

HEADERS = netlify_rules('_headers')
REDIRECTS = netlify_rules('_redirects')

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        for source, target, status in REDIRECTS:
            if path == source:
                self.send_response(status)
                self.send_header('Location', target)
                self.end_headers()
                return
        if path == '/env.js' and not DIST_MODE:
            data = env_module().encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        if path == '/api/foto':
            return self.download()
        if path == '/api/resultados':
            return self.results()
        if re.fullmatch(r'/api/zip/[A-Za-z0-9_-]+', path) and path != '/api/zip/prepare':
            return self.zip_download(path.rsplit('/', 1)[1])
        super().do_GET()

    def send_head(self):
        path = unquote(urlsplit(self.path).path)
        parts = [part for part in path.split('/') if part]
        if any(part.startswith('.') or '\x00' in part or '\\' in part for part in parts):
            return self.not_found()
        target = SITE.joinpath(*parts)
        if target.is_dir() and (target / 'index.html').exists():
            if not path.endswith('/'):
                self.path = path + '/index.html'
        elif not target.is_file():
            return self.not_found()
        return super().send_head()

    def not_found(self):
        page = (SITE / '404.html').read_bytes()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(page)))
        self.end_headers()
        self.wfile.write(page)
        return None

    def list_directory(self, path):
        return self.not_found()

    def download(self):
        """Espelho local de netlify/functions/foto.mjs: baixa o original com attachment."""
        photo_id = parse_qs(urlsplit(self.path).query).get('id', [''])[0]
        if not re.fullmatch(r'[a-f0-9]{64}', photo_id):
            return self.send_error(400, 'Foto invalida')
        photo = gallery().get(photo_id)
        if not photo:
            return self.send_error(404, 'Foto nao encontrada')
        # O R2 público recusa o User-Agent padrão do urllib.
        request = Request(photo['original'], headers={'User-Agent': 'Mozilla/5.0 (ENTEC local)'})
        try:
            upstream = urlopen(request, timeout=30)
        except Exception:
            return self.send_error(502, 'Nao foi possivel obter o original')
        with upstream:
            filename = photo['filename']
            fallback = re.sub(r'[^\w.()-]', '_', filename, flags=re.A)
            self.send_response(200)
            self.send_header('Content-Type', upstream.headers.get('Content-Type', 'application/octet-stream'))
            self.send_header('Content-Disposition', f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename, safe='')}")
            if upstream.headers.get('Content-Length'):
                self.send_header('Content-Length', upstream.headers['Content-Length'])
            self.end_headers()
            shutil.copyfileobj(upstream, self.wfile, 64 * 1024)

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == '/api/resultados':
            return self.results()
        if path == '/api/zip/prepare':
            return self.zip_prepare()
        self.send_error(405)

    def send_json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def zip_prepare(self):
        """Espelho local de POST /zip/prepare do Worker (worker/src/index.js)."""
        data = manifest()
        try:
            length = min(int(self.headers.get('Content-Length', 0)), 200_000)
            ids = json.loads(self.rfile.read(length) or b'{}').get('ids')
        except (ValueError, AttributeError):
            return self.send_json(400, {'error': 'Pedido inválido.'})
        if not isinstance(ids, list) or not ids:
            return self.send_json(400, {'error': 'Nenhuma foto selecionada.'})
        if len(ids) > MAX_ZIP_PHOTOS:
            return self.send_json(413, {'error': f'Selecione no máximo {MAX_ZIP_PHOTOS} fotos por download.'})
        if any(not isinstance(i, str) or i not in data['index'] for i in ids):
            return self.send_json(400, {'error': 'Foto fora da galeria.'})
        indices = sorted({data['index'][i] for i in ids})
        _, _, total = zip_plan(data['photos'], indices)
        token = encode_selection(indices, len(data['photos']))
        self.send_json(200, {'url': f"/api/zip/{token}?v={data['version']}", 'filename': f'ENTEC-2026-{len(indices):02d}-fotos.zip',
                             'count': len(indices), 'bytes': total})

    def zip_download(self, token):
        """Espelho local de GET /zip/<seleção>: ZIP em streaming, um original por vez."""
        data = manifest()
        if parse_qs(urlsplit(self.path).query).get('v', [''])[0] != data['version']:
            return self.send_error(409, 'Galeria atualizada')
        indices = decode_selection(token, len(data['photos']))
        if not indices or len(indices) > MAX_ZIP_PHOTOS:
            return self.send_error(400, 'Selecao invalida')
        entries, trailer, total = zip_plan(data['photos'], indices)
        self.send_response(200)
        self.send_header('Content-Type', 'application/zip')
        self.send_header('Content-Disposition', f'attachment; filename="ENTEC-2026-{len(indices):02d}-fotos.zip"')
        self.send_header('Content-Length', str(total))
        self.end_headers()
        base = gallery()
        for photo_id, name, size, local in entries:
            request = Request(base[photo_id]['original'], headers={'User-Agent': 'Mozilla/5.0 (ENTEC local)'})
            with urlopen(request, timeout=30) as upstream:
                if int(upstream.headers.get('Content-Length', -1)) != size:
                    raise ConnectionError(f'Original divergente: {name}')
                self.wfile.write(local)
                shutil.copyfileobj(upstream, self.wfile, 64 * 1024)
        self.wfile.write(trailer)

    def results(self):
        """Espelho local de netlify/functions/resultados.mjs (somente public_status)."""
        env = site_env()
        url, key = env['VITE_SUPABASE_URL'].rstrip('/'), env['VITE_SUPABASE_ANON_KEY']
        if not url or not key:
            return self.send_json(503, {'error': 'Serviço de resultados não configurado.'})
        request = Request(f'{url}/functions/v1/event-results', data=b'{"action":"public_status"}', method='POST',
                          headers={'Content-Type': 'application/json', 'apikey': key, 'Authorization': f'Bearer {key}',
                                   'User-Agent': 'Mozilla/5.0 (ENTEC local)'})
        try:
            with urlopen(request, timeout=20) as upstream:
                status, body = upstream.status, upstream.read()
        except HTTPError as error:
            status, body = error.code, error.read()
        except Exception:
            status, body = 502, '{"error":"Serviço de resultados indisponível."}'.encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        path = urlsplit(self.path).path.replace('/index.html', '') or '/'
        for pattern, values in HEADERS:
            if matches(pattern, path):
                for key, value in values:
                    if key.lower() != 'cache-control':
                        self.send_header(key, value)
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(ARGS[0]) if ARGS else 5173
server = ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=str(SITE)))
print(f'ENTEC ({SITE.name}/): http://localhost:{port} — Ctrl+C para encerrar', flush=True)
server.serve_forever()
