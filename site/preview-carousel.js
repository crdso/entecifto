// Prévia de Fotos: 30 fotos distintas de gallery.json (thumbnails) no carrossel 3D original.
// O carrossel tem 12 faces visíveis possíveis; cada face só troca de foto enquanto está
// de costas para a câmera ou fora da tela, e nenhuma foto ocupa duas faces ao mesmo tempo.
const THUMBS = 'https://pub-73a76ebfad354022a61b3486417cdbe4.r2.dev/entec-galeria-2026/thumbs/';
const POOL = [
  ['cc8b476bdf87d56a407afcfa021c5bf6d17ab5813d65c3d1e15fe25af2e87cbb.webp', 'IMG_6653.jpg'],
  ['2348c8e8498beab6e21c67363ebc61374bd33e6860855135e497a5fc1b7db0ca.webp', '170-IMG_7093.jpg'],
  ['7e604c3ea525b8cf2c85e6ed54ec885a5e6d5f7f9ed8ce9d9251aa0d11c8e828.webp', 'IMG_6525.jpg'],
  ['54d7682ef653c55ef5526f6aa02b216ec75929ce855b62c2a231403afad04c53.webp', '105-IMG_6201.jpg'],
  ['8463f1e0d4cab5c3d4742e5e73a980264c012b161f43c880b4bf2e33d98afe4c.webp', '50-IMG_6967.jpg'],
  ['d7c153a2e36d4eab7660a2f19a882ec124f306b66a6e056f94ebbf4424653c09.webp', '155-IMG_6508.jpg'],
  ['426c90998acb04f7fdfe146fc081e54d2c373dc3f55eca2875244b30b3d7c6cc.webp', '257-IMG_6623.jpg'],
  ['ecfe7835f580022508ce903f3f52a168ba2d6501cb3e28d4b35bd3d099d27da7.webp', '23-IMG_6248.jpg'],
  ['370ec4224e5544db8eb9b936dbf25f4b0a73c831bcc77982d11a351cf9567c48.webp', '81-IMG_6998.jpg'],
  ['64d90331ddc63614cefa991a474120f62dceb4060f41659f1c4eac73fb5ebb90.webp', 'IMG_6579.jpg'],
  ['7809e71604b821420019e4d95a480170d51f29c384ad3bf3fed8c0e74358d8cc.webp', '173-IMG_7096.jpg'],
  ['8b3925fe18e0d8dc9f3298d1c8ab1abea09056891139de8eaffec78a01788df8.webp', '128-IMG_6332.jpg'],
  ['44af5b46a0036e3469f6be7eb27c6c2423c393673a0a006c33eb7ba71c193f46.webp', '2-IMG_6656.jpg'],
  ['fc8b5617b7b9946731f17706cddc4b2ef4715abfb1158713ff22132fb53d19ec.webp', '44-IMG_6961.jpg'],
  ['8ab8f96e601141eebbd503bca8f7a054b55360ea51730f13b71c082d9b0c63bb.webp', '75-IMG_6992.jpg'],
  ['710820bf30c784b36f3311e58da3df39f1447900286f3c1ce19e7978473aef01.webp', '274-IMG_6640.jpg'],
  ['b033e65fca35dc6935566b46ef434f8286a4126cf09d25bb7b0ea47955ccbb47.webp', '88-IMG_7005.jpg'],
  ['8f6354a960b2f2f6b5a61a9c82db5128f4d8a372f3909d1c3dccd44e0dad83e5.webp', '222-IMG_6507.jpg'],
  ['f57ca678287f52752a5f51ec8e853815be1642b26c003fd7d8410ef2526221ed.webp', '151-IMG_6499.jpg'],
  ['5c383976aa2b278068d36b8dde0907dabaa2982591851fc7963d6c8d9cfef848.webp', 'IMG_6553.jpg'],
  ['f4d1107c2f5337a2611351a5d16b5463cc09276833d6407b1f1e89c0c366e9bd.webp', '59-IMG_6976.jpg'],
  ['e15dd4890a504074dbfecff6877eaf9e05ff970f768a12297507f27160183ce2.webp', '297-IMG_6681.jpg'],
  ['d031181aa65aca58b46788c2928073c4d6a1c4a20954c51ea23d7444b66dddad.webp', '78-IMG_6165.jpg'],
  ['724172e32860f93418bf6637c4624645b0e580d7d3f6d9d9e9ebcafbd6fc102e.webp', '6-IMG_6919.jpg'],
  ['65a8426282c9e07053b0563d5ced2449c7b766b543c4bce1b428d3c07f239027.webp', '190-IMG_6568.jpg'],
  ['3bfc097a1738529d70c27959b55a5284296205f3be16b472e12afbfbf301ea13.webp', '35-IMG_6950.jpg'],
  ['c2776b521e0c98da3dd30a266ca37569e950e8c9a0503e564b319ea4d80f6e64.webp', 'IMG_6633.jpg'],
  ['2fb70593da0331fa82853c44523fbaa6949abd4c11032190202112c0c291ccb1.webp', '47-IMG_6964.jpg'],
  ['91cc681610929be92754505732e8dd2e8a5110bbe4e5db937d6dc16d639c2406.webp', '234-IMG_6593.jpg'],
  ['540ad18bbb67dd3e446e3cadc7a457b593204cb81396053dd29593c93239e71b.webp', 'IMG_6496.jpg']
].map(([file, name]) => ({ src: THUMBS + file, name }));

const FACES = '#galeria .framer-wt1bfw > :not(.framer-qqaimq) > *';
const assigned = new Map(); // face -> índice em POOL
const hiddenSince = new WeakSet(); // faces que já trocaram durante o período oculto atual
const preloaded = new Set();
let cursor = 0;
let adopted = false;

function faceImage(face) { return face.querySelector('img'); }

// Normal da face no espaço da seção, acumulando as transformações 3D ancestrais.
function faceNormalZ(face, root) {
  const chain = [];
  for (let el = face; el && el !== root; el = el.parentElement) chain.push(el);
  let matrix = new DOMMatrix();
  for (let i = chain.length - 1; i >= 0; i--) {
    const transform = getComputedStyle(chain[i]).transform;
    if (transform && transform !== 'none') matrix = matrix.multiply(new DOMMatrix(transform));
  }
  return matrix.transformPoint(new DOMPoint(0, 0, 1, 0)).z;
}

function isOutOfView(face, root) {
  if (faceNormalZ(face, root) < -0.94) return true; // atrás da câmera
  const rect = face.getBoundingClientRect();
  return rect.width < 600 && (rect.right <= 0 || rect.left >= innerWidth);
}

function show(face, index) {
  const image = faceImage(face);
  if (!image) return;
  assigned.set(face, index);
  const photo = POOL[index];
  image.removeAttribute('srcset');
  image.alt = `Foto do ENTEC 2026: ${photo.name}`;
  if (image.getAttribute('src') !== photo.src) image.src = photo.src;
}

function nextFree() {
  const used = new Set(assigned.values());
  for (let step = 0; step < POOL.length; step++) {
    const index = (cursor + step) % POOL.length;
    if (!used.has(index)) { cursor = (index + 1) % POOL.length; return index; }
  }
  return -1;
}

function preload(index) {
  if (index < 0 || preloaded.has(index)) return;
  preloaded.add(index);
  const image = new Image();
  image.decoding = 'async';
  image.src = POOL[index].src;
}

function tick(root) {
  const faces = [...document.querySelectorAll(FACES)].filter(faceImage);
  for (const face of assigned.keys()) if (!face.isConnected) assigned.delete(face);
  // Adota as faces montadas pelo Framer (fotos iniciais já vêm distintas do módulo).
  for (const face of faces) {
    if (assigned.has(face)) continue;
    const current = POOL.findIndex(photo => photo.src === faceImage(face).getAttribute('src'));
    const taken = new Set(assigned.values());
    show(face, current >= 0 && !taken.has(current) ? current : nextFree());
  }
  if (!adopted && assigned.size) {
    adopted = true;
    cursor = (Math.max(...assigned.values()) + 1) % POOL.length;
  }
  for (const face of faces) {
    if (!isOutOfView(face, root)) { hiddenSince.delete(face); continue; }
    if (hiddenSince.has(face)) continue;
    hiddenSince.add(face);
    assigned.delete(face);
    show(face, nextFree());
  }
}

const root = document.getElementById('galeria');
if (root && 'DOMMatrix' in window) {
  let visible = false, timer = 0;
  const run = () => { tick(root); timer = visible && !document.hidden ? setTimeout(run, 250) : 0; };
  const start = () => { if (!timer && visible && !document.hidden) run(); };
  new IntersectionObserver(entries => {
    visible = entries[entries.length - 1].isIntersecting;
    start();
  }).observe(root);
  document.addEventListener('visibilitychange', start);
  // Aquece o cache com as próximas fotos quando a seção se aproxima.
  new IntersectionObserver((entries, observer) => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    POOL.forEach((_, index) => setTimeout(() => preload(index), index * 120));
  }, { rootMargin: '600px 0px' }).observe(root);
}
