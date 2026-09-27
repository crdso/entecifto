"""Gera worker/src/manifest.json a partir de gallery.json + HEAD (somente leitura) no R2.

Uso: .venv/Scripts/python.exe worker/build_manifest.py
Cada item: [id, nome original, tamanho em bytes, CRC32 (inteiro)] na ordem de gallery.json.
Nenhum objeto é criado, alterado ou reenviado.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import base64, hashlib, json
import boto3

ROOT = Path(__file__).resolve().parent.parent
env = dict(line.strip().split('=', 1) for line in (ROOT / '.r2.env').read_text(encoding='utf-8').splitlines()
           if '=' in line and not line.startswith('#'))
bucket = env['R2_BUCKET']
client = boto3.client('s3', endpoint_url=env['R2_ENDPOINT'], aws_access_key_id=env['R2_ACCESS_KEY_ID'],
                      aws_secret_access_key=env['R2_SECRET_ACCESS_KEY'], region_name='auto')
photos = json.loads((ROOT / 'site' / 'gallery.json').read_text(encoding='utf-8'))

def head(photo):
    key = f"{bucket}/originals/{photo['id']}/{photo['filename']}"
    meta = client.head_object(Bucket=bucket, Key=key, ChecksumMode='ENABLED')
    crc = meta.get('ChecksumCRC32')
    if not crc or '-' in crc:
        raise RuntimeError(f'CRC32 ausente ou multipart: {key}')
    return [photo['id'], photo['filename'], meta['ContentLength'], int.from_bytes(base64.b64decode(crc), 'big')]

with ThreadPoolExecutor(16) as pool:
    items = list(pool.map(head, photos))
version = hashlib.sha256('\n'.join(item[0] for item in items).encode()).hexdigest()[:12]
manifest = {'version': version, 'prefix': f'{bucket}/originals/', 'photos': items}
(ROOT / 'worker' / 'src' / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(items)} fotos · versão {version} · {sum(i[2] for i in items) / 2**20:.1f} MiB')
