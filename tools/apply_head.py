"""Padroniza o <head> de todas as páginas do site (título, descrição, ícones, Open Graph).

Uso: python tools/apply_head.py   (idempotente; reescreve o bloco entre os marcadores ENTEC:HEAD)
Os textos de título/descrição vêm de entec/src/components/RouteMeta.jsx do site anterior;
as páginas novas (galeria, certificado) seguem o mesmo padrão.
"""
from pathlib import Path
import html, re

SITE = Path(__file__).resolve().parent.parent / 'site'
ORIGIN = 'https://entecifto.online'
OG_IMAGE = f'{ORIGIN}/og-entec-2026.jpg'
DEFAULT_OG_TITLE = 'ENTEC 2026 - Encontro de Tecnologia do IFTO'
DEFAULT_OG_DESC = 'Futuro conectado: como a tecnologia está redesenhando o mundo.'

PAGES = {
    'index.html': ('ENTEC 2026 - Encontro de Tecnologia do IFTO',
                   'ENTEC 2026 - Encontro de Tecnologia do IFTO. Futuro conectado: como a tecnologia está redesenhando o mundo.', '/'),
    'sobre/index.html': ('Sobre | ENTEC 2026', 'Conheça o ENTEC 2026 e a proposta do evento sobre tecnologia, inovação e futuro conectado.', '/sobre'),
    'galeria/index.html': ('Galeria | ENTEC 2026', 'Explore as fotos oficiais do ENTEC 2026 e reviva os momentos do evento.', '/galeria'),
    'certificado/index.html': ('Certificado | ENTEC 2026', 'Consulte e baixe seu certificado de participação no ENTEC 2026.', '/certificado'),
    'resultados/index.html': ('Resultados dos Stands | ENTEC 2026', 'Acompanhe a divulgação oficial do pódio dos stands do ENTEC 2026.', '/resultados'),
    'privacidade/index.html': ('Política de Privacidade | ENTEC 2026', 'Consulte a Política de Privacidade do site oficial do ENTEC 2026.', '/privacidade'),
    'admin/index.html': ('Administração | ENTEC 2026', 'Painel administrativo do ENTEC 2026.', None),
    '404.html': ('Página não encontrada | ENTEC 2026', 'A página que você tentou acessar não existe ou pode ter sido movida.', None),
}

def block(title, description, path):
    e = lambda s: html.escape(s, quote=True)
    lines = [
        f'<title>{e(title)}</title>',
        f'<meta name="description" content="{e(description)}">',
        '<meta name="theme-color" content="#07003e">',
        '<link rel="icon" href="/favicon.ico" sizes="any">',
        '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">',
        '<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">',
        '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
        '<link rel="manifest" href="/manifest.json">',
    ]
    if path is None:
        lines.append('<meta name="robots" content="noindex, nofollow, noarchive">')
    else:
        url = ORIGIN + path
        og_title = DEFAULT_OG_TITLE if path == '/' else title
        og_desc = DEFAULT_OG_DESC if path == '/' else description
        lines += [
            '<meta name="robots" content="index, follow, max-image-preview:large">',
            f'<link rel="canonical" href="{url}">',
            '<meta property="og:type" content="website">',
            '<meta property="og:locale" content="pt_BR">',
            '<meta property="og:site_name" content="ENTEC 2026">',
            f'<meta property="og:title" content="{e(og_title)}">',
            f'<meta property="og:description" content="{e(og_desc)}">',
            f'<meta property="og:url" content="{url}">',
            f'<meta property="og:image" content="{OG_IMAGE}">',
            '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            '<meta property="og:image:alt" content="ENTEC 2026 — Futuro conectado: como a tecnologia está redesenhando o mundo">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{e(og_title)}">',
            f'<meta name="twitter:description" content="{e(og_desc)}">',
            f'<meta name="twitter:image" content="{OG_IMAGE}">',
        ]
    return '<!--ENTEC:HEAD-->\n  ' + '\n  '.join(lines) + '\n  <!--/ENTEC:HEAD-->'

# Metadados antigos que o bloco substitui (inclusive os do clone Framer).
STALE = [
    r'\s*<title>[^<]*</title>',
    r'\s*<meta name="(?:description|theme-color|robots|generator|twitter:[a-z]+)"[^>]*>',
    r'\s*<meta property="og:[^"]+"[^>]*>',
    r'\s*<link rel="(?:icon|apple-touch-icon|manifest|canonical)"[^>]*>',
    r'\s*<link href="[^"]*"\s+rel="(?:icon|apple-touch-icon)"[^>]*>',
    r'\s*<!-- (?:Made in Framer[^>]*|Published [^>]*|Open Graph|X|Start of headStart|End of headStart) -->',
]

for rel, (title, description, path) in PAGES.items():
    file = SITE / rel
    if not file.exists():
        continue
    text = file.read_text(encoding='utf-8')
    text = re.sub(r'<!--ENTEC:HEAD-->.*?<!--/ENTEC:HEAD-->', '<!--ENTEC:HEAD-->', text, flags=re.S)
    head_end = text.index('</head>')
    head, rest = text[:head_end], text[head_end:]
    for pattern in STALE:
        head = re.sub(pattern, '', head)
    if '<!--ENTEC:HEAD-->' not in head:
        head = re.sub(r'(<meta name="viewport"[^>]*>)', r'\1\n  <!--ENTEC:HEAD-->', head, count=1)
    head = head.replace('<!--ENTEC:HEAD-->', block(title, description, path), 1)
    file.write_text(head + rest, encoding='utf-8', newline='\n')
    print('ok', rel)
