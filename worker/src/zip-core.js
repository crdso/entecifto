// Núcleo do download em ZIP da galeria ENTEC 2026 (sem dependências de plataforma).
// Usado pela Netlify Edge Function (netlify/edge-functions/zip.js) e pelo Worker Cloudflare
// (worker/src/index.js); cada um só informa como obter o original de uma foto.
//
// POST <base>/prepare  {"ids": ["<id>", ...]}  -> {"url", "filename", "count", "bytes"}
// GET  <base>/<seleção>?v=<versão>             -> ENTEC-2026-XX-fotos.zip (attachment, streaming)
//
// Só aceita ids do manifesto (gerado de gallery.json por build_manifest.py). O ZIP usa STORE e
// o CRC32 já registrado no R2: cada original é repassado em streaming, uma foto por vez, sem
// ficar inteiro em memória e sem recalcular nada.
import manifest from './manifest.json' with { type: 'json' };

export const MANIFEST_PREFIX = manifest.prefix;
const PHOTOS = manifest.photos; // [id, nome, tamanho, crc32]
const INDEX = new Map(PHOTOS.map((photo, index) => [photo[0], index]));
const ID_PATTERN = /^[a-f0-9]{64}$/;
const encoder = new TextEncoder();

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Seleção compacta: bitmap dos índices do manifesto em base64url (~122 caracteres para 727 fotos).
export function encodeSelection(indices) {
  const bytes = new Uint8Array(Math.ceil(PHOTOS.length / 8));
  for (const index of indices) bytes[index >> 3] |= 1 << (index & 7);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSelection(token) {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  let binary;
  try { binary = atob(token.replace(/-/g, '+').replace(/_/g, '/')); } catch { return null; }
  if (binary.length !== Math.ceil(PHOTOS.length / 8)) return null;
  const indices = [];
  for (let index = 0; index < PHOTOS.length; index++) {
    if (binary.charCodeAt(index >> 3) & (1 << (index & 7))) indices.push(index);
  }
  return indices;
}

function zipFilename(count) {
  return `ENTEC-2026-${String(count).padStart(2, '0')}-fotos.zip`;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

// Estrutura completa do ZIP (sem os dados): permite Content-Length exato antes do primeiro byte.
export function zipPlan(indices, now = new Date()) {
  const { time, day } = dosDateTime(now);
  const entries = [];
  let offset = 0;
  for (const index of indices) {
    const [, name, size, crc] = PHOTOS[index];
    const nameBytes = encoder.encode(name);
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0x0800, true); // nomes em UTF-8
    header.setUint16(8, 0, true); // STORE
    header.setUint16(10, time, true);
    header.setUint16(12, day, true);
    header.setUint32(14, crc >>> 0, true);
    header.setUint32(18, size, true);
    header.setUint32(22, size, true);
    header.setUint16(26, nameBytes.length, true);
    header.setUint16(28, 0, true);
    entries.push({ index, name, nameBytes, size, crc, offset, local: concat(new Uint8Array(header.buffer), nameBytes) });
    offset += 30 + nameBytes.length + size;
  }
  const central = [];
  for (const entry of entries) {
    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true);
    record.setUint16(4, 20, true);
    record.setUint16(6, 20, true);
    record.setUint16(8, 0x0800, true);
    record.setUint16(10, 0, true);
    record.setUint16(12, time, true);
    record.setUint16(14, day, true);
    record.setUint32(16, entry.crc >>> 0, true);
    record.setUint32(20, entry.size, true);
    record.setUint32(24, entry.size, true);
    record.setUint16(28, entry.nameBytes.length, true);
    record.setUint32(42, entry.offset, true);
    central.push(new Uint8Array(record.buffer), entry.nameBytes);
  }
  const centralBytes = concat(...central);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralBytes.length, true);
  end.setUint32(16, offset, true);
  const trailer = concat(centralBytes, new Uint8Array(end.buffer));
  return { entries, trailer, total: offset + trailer.length };
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of parts) { out.set(part, position); position += part.length; }
  return out;
}

// getOriginal(key) -> { size, body: ReadableStream } | null
async function writeZip(plan, getOriginal, writable) {
  try {
    for (const entry of plan.entries) {
      const object = await getOriginal(manifest.prefix + PHOTOS[entry.index][0] + '/' + entry.name);
      if (!object || object.size !== entry.size) throw new Error(`Original indisponível: ${entry.name}`);
      const writer = writable.getWriter();
      await writer.write(entry.local);
      writer.releaseLock();
      // Repasse nativo do stream: não acumula o arquivo e quase não gasta CPU.
      await object.body.pipeTo(writable, { preventClose: true });
    }
    const writer = writable.getWriter();
    await writer.write(plan.trailer);
    await writer.close();
  } catch (error) {
    await writable.abort(error).catch(() => {});
  }
}

export function createZipHandler({ basePath, maxPhotos = PHOTOS.length, getOriginal }) {
  const limit = Math.min(Number(maxPhotos) || PHOTOS.length, PHOTOS.length);

  async function prepare(request) {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Pedido inválido.' }, 400); }
    const ids = Array.isArray(body?.ids) ? body.ids : null;
    if (!ids || !ids.length) return json({ error: 'Nenhuma foto selecionada.' }, 400);
    if (ids.length > limit) return json({ error: `Selecione no máximo ${limit} fotos por download.` }, 413);
    const indices = new Set();
    for (const id of ids) {
      if (typeof id !== 'string' || !ID_PATTERN.test(id) || !INDEX.has(id)) return json({ error: 'Foto fora da galeria.' }, 400);
      indices.add(INDEX.get(id));
    }
    const sorted = [...indices].sort((a, b) => a - b);
    const url = new URL(`${basePath}/${encodeSelection(sorted)}`, request.url);
    url.searchParams.set('v', manifest.version);
    return json({ url: url.pathname + url.search, filename: zipFilename(sorted.length), count: sorted.length, bytes: zipPlan(sorted).total });
  }

  function download(request, token, waitUntil) {
    if (new URL(request.url).searchParams.get('v') !== manifest.version) {
      return new Response('A galeria foi atualizada. Volte à página e tente novamente.', { status: 409 });
    }
    const indices = decodeSelection(token);
    if (!indices || !indices.length || indices.length > limit) return new Response('Seleção inválida.', { status: 400 });
    const plan = zipPlan(indices);
    const headers = {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFilename(indices.length)}"`,
      'Content-Length': String(plan.total),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (request.method === 'HEAD') return new Response(null, { headers });
    // FixedLengthStream (Workers) mantém o Content-Length exato; nos demais runtimes, TransformStream.
    const { readable, writable } = typeof FixedLengthStream === 'function' ? new FixedLengthStream(plan.total) : new TransformStream();
    const job = writeZip(plan, getOriginal, writable);
    waitUntil?.(job);
    return new Response(readable, { headers });
  }

  return async function handle(request, waitUntil) {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (pathname === `${basePath}/prepare`) {
      return request.method === 'POST' ? prepare(request) : json({ error: 'Use POST.' }, 405);
    }
    const token = pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length + 1) : '';
    if (/^[A-Za-z0-9_-]+$/.test(token) && (request.method === 'GET' || request.method === 'HEAD')) return download(request, token, waitUntil);
    return new Response('Não encontrado.', { status: 404 });
  };
}
