const PAGE_SIZE = 40;
const DOWNLOAD_ENDPOINT = '/api/foto';
// ZIP das selecionadas: Worker ligado ao R2 (em produção via proxy /api/zip/* do netlify.toml).
const ZIP_PREPARE_ENDPOINT = '/api/zip/prepare';
const ZIP_PREPARE_TIMEOUT = 20000;
const grid = document.getElementById('gallery-grid');
const archive = document.getElementById('fotos');
const status = document.getElementById('gallery-status');
const pagination = document.getElementById('gallery-pagination');
const pageList = document.getElementById('gallery-pages');
const pageInfo = document.getElementById('gallery-page-info');
const countLabel = document.getElementById('gallery-count');
const modeButton = document.getElementById('gallery-mode-button');
const modeLabel = modeButton.querySelector('.gallery-mode-label');
const selectionBar = document.getElementById('gallery-selection-bar');
const selectionCount = document.getElementById('gallery-selection-count');
const lightbox = document.getElementById('gallery-lightbox');
const lightboxImage = document.getElementById('gallery-lightbox-image');
const lightboxCounter = document.getElementById('gallery-lightbox-counter');
const lightboxFilename = document.getElementById('gallery-lightbox-filename');
const lightboxSelect = document.getElementById('gallery-lightbox-select');
const prevButton = document.getElementById('gallery-lightbox-prev');
const nextButton = document.getElementById('gallery-lightbox-next');
const toast = document.getElementById('gallery-toast');

let photos = [];
let page = 1;
let totalPages = 1;
let cards = [];
let columns = [];
let columnHeights = [];
let currentColumns = 0;
let selectionMode = false;
let lightboxIndex = -1;
let lightboxRequest = 0;
let adjacentPreloads = [];
let previousFocus = null;
let toastTimer;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const selected = new Set();

function numberOfColumns() {
  const width = window.innerWidth;
  if (width <= 700) return 2;
  if (width <= 1100) return 3;
  if (width <= 1700) return 4;
  if (width <= 2100) return 5;
  return 6;
}

function createColumns(count) {
  currentColumns = count;
  columnHeights = Array(count).fill(0);
  columns = Array.from({ length: count }, () => {
    const column = document.createElement('div');
    column.className = 'gallery-column';
    return column;
  });
  grid.style.setProperty('--gallery-columns', count);
  grid.replaceChildren(...columns);
}

function placeCard(card, photo) {
  const target = columnHeights.indexOf(Math.min(...columnHeights));
  columns[target].append(card);
  columnHeights[target] += photo.height / photo.width + 0.025;
}

function reflowColumns() {
  const count = numberOfColumns();
  if (count !== currentColumns) {
    createColumns(count);
    cards.forEach(card => placeCard(card, photos[Number(card.dataset.index)]));
  }
  renderPagination();
}

function photoCard(photo, index, position) {
  const card = document.createElement('article');
  card.className = 'gallery-photo';
  card.dataset.index = String(index);
  card.style.setProperty('--photo-ratio', `${photo.width} / ${photo.height}`);

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'gallery-photo-open';
  open.dataset.action = 'open';
  open.setAttribute('aria-label', `Abrir foto ${index + 1} de ${photos.length}: ${photo.filename}`);

  const image = document.createElement('img');
  image.width = photo.width;
  image.height = photo.height;
  image.alt = '';
  // A primeira faixa da página carrega de imediato; o restante, conforme a rolagem.
  image.loading = position < 8 ? 'eager' : 'lazy';
  if (position < 4) image.fetchPriority = 'high';
  image.decoding = 'async';
  image.addEventListener('load', () => card.classList.add('is-ready'), { once: true });
  image.addEventListener('error', () => card.classList.add('is-error'), { once: true });
  image.src = photo.thumbnail;

  const number = document.createElement('span');
  number.className = 'gallery-photo-index';
  number.setAttribute('aria-hidden', 'true');
  number.textContent = String(index + 1).padStart(3, '0');
  open.append(image, number);

  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'gallery-photo-check';
  check.dataset.action = 'select';
  const isSelected = selected.has(index);
  card.classList.toggle('is-selected', isSelected);
  check.setAttribute('aria-label', `${isSelected ? 'Remover seleção da' : 'Selecionar'} foto ${index + 1}`);
  check.setAttribute('aria-pressed', String(isSelected));
  check.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  card.append(open, check);
  return card;
}

function pageOf(index) {
  return Math.floor(index / PAGE_SIZE) + 1;
}

function pageFromUrl() {
  const value = Number(new URLSearchParams(location.search).get('page'));
  return Number.isInteger(value) && value >= 1 ? Math.min(value, totalPages) : 1;
}

function pageUrl(target) {
  const url = new URL(location.href);
  if (target > 1) url.searchParams.set('page', String(target));
  else url.searchParams.delete('page');
  return url.pathname + url.search;
}

// 1 … 8 9 10 … 19 — janela ao redor da página atual, com as extremidades sempre visíveis.
function pageItems(current, total, siblings) {
  const slots = siblings * 2 + 5;
  if (total <= slots) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(current - siblings, total - siblings * 2 - 2));
  const end = Math.min(total - 1, Math.max(current + siblings, siblings * 2 + 3));
  const items = [1];
  if (start > 2) items.push('gap');
  for (let n = start; n <= end; n++) items.push(n);
  if (end < total - 1) items.push('gap');
  items.push(total);
  return items;
}

function pageControl(target, label, content, className) {
  const disabled = target < 1 || target > totalPages;
  const control = document.createElement(disabled ? 'span' : 'a');
  control.className = className;
  control.innerHTML = content;
  control.setAttribute('aria-label', label);
  if (disabled) control.setAttribute('aria-disabled', 'true');
  else {
    control.href = pageUrl(target);
    control.dataset.page = String(target);
  }
  return control;
}

function renderPagination() {
  if (!photos.length) return;
  pagination.hidden = totalPages <= 1;
  const siblings = window.innerWidth < 560 ? 0 : 1;
  const arrow = direction => `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="${direction < 0 ? 'M12.5 4.5 7 10l5.5 5.5' : 'm7.5 4.5 5.5 5.5-5.5 5.5'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const children = [pageControl(page - 1, 'Página anterior', arrow(-1), 'gallery-page-arrow')];
  for (const item of pageItems(page, totalPages, siblings)) {
    if (item === 'gap') {
      const gap = document.createElement('span');
      gap.className = 'gallery-page-gap';
      gap.setAttribute('aria-hidden', 'true');
      gap.textContent = '…';
      children.push(gap);
      continue;
    }
    const link = pageControl(item, `Página ${item}`, String(item), 'gallery-page-number');
    if (item === page) link.setAttribute('aria-current', 'page');
    children.push(link);
  }
  children.push(pageControl(page + 1, 'Próxima página', arrow(1), 'gallery-page-arrow'));
  pageList.replaceChildren(...children);
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, photos.length);
  pageInfo.textContent = `Página ${page} de ${totalPages} · fotos ${first}–${last}`;
}

function renderPage(target) {
  page = Math.min(Math.max(1, target), totalPages);
  createColumns(numberOfColumns());
  cards = [];
  const first = (page - 1) * PAGE_SIZE;
  const last = Math.min(first + PAGE_SIZE, photos.length);
  for (let index = first; index < last; index++) {
    const card = photoCard(photos[index], index, index - first);
    cards.push(card);
    placeCard(card, photos[index]);
  }
  grid.dataset.page = String(page);
  grid.classList.remove('is-entering');
  void grid.offsetWidth;
  grid.classList.add('is-entering');
  countLabel.textContent = `${photos.length.toLocaleString('pt-BR')} fotografias · acervo oficial`;
  renderPagination();
  updateSelection();
}

function scrollToArchive(smooth = true) {
  const top = Math.max(0, archive.getBoundingClientRect().top + window.scrollY - 12);
  if (!smooth || reduceMotion.matches || document.hidden) {
    window.scrollTo({ top, behavior: 'auto' });
    return;
  }
  // Longas distâncias: aproxima sem animação e suaviza só o trecho final.
  const lead = window.innerHeight * 0.6;
  if (window.scrollY - top > lead) window.scrollTo({ top: top + lead, behavior: 'auto' });
  window.scrollTo({ top, behavior: 'smooth' });
}

function goToPage(target, { push = true, scroll = true } = {}) {
  const next = Math.min(Math.max(1, target), totalPages);
  if (push && next !== page) history.pushState({ page: next }, '', pageUrl(next));
  renderPage(next);
  if (scroll) scrollToArchive();
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4400);
}

function updateSelection() {
  grid.classList.toggle('is-selecting', selectionMode);
  modeButton.setAttribute('aria-pressed', String(selectionMode));
  modeLabel.textContent = selectionMode ? 'Concluir seleção' : 'Selecionar fotos';
  selectionBar.hidden = selected.size === 0;
  selectionCount.textContent = `${selected.size} ${selected.size === 1 ? 'foto selecionada' : 'fotos selecionadas'}`;
  cards.forEach(card => {
    const index = Number(card.dataset.index);
    const active = selected.has(index);
    card.classList.toggle('is-selected', active);
    const check = card.querySelector('.gallery-photo-check');
    check.setAttribute('aria-pressed', String(active));
    check.setAttribute('aria-label', `${active ? 'Remover seleção da' : 'Selecionar'} foto ${index + 1}`);
  });
  if (lightboxIndex >= 0) {
    const active = selected.has(lightboxIndex);
    lightboxSelect.setAttribute('aria-pressed', String(active));
    lightboxSelect.textContent = active ? 'Selecionada ✓' : 'Selecionar';
  }
}

function toggleSelection(index) {
  if (selected.has(index)) selected.delete(index);
  else selected.add(index);
  if (selected.size) selectionMode = true;
  updateSelection();
}

function preloadNeighbors(index) {
  adjacentPreloads = [];
  for (const neighbor of [index - 1, index + 1]) {
    if (neighbor < 0 || neighbor >= photos.length) continue;
    const preload = new Image();
    preload.decoding = 'async';
    preload.src = photos[neighbor].original;
    adjacentPreloads.push(preload);
  }
}

function showLightboxPhoto(index) {
  if (index < 0 || index >= photos.length) return;
  lightboxIndex = index;
  const photo = photos[index];
  const request = ++lightboxRequest;
  adjacentPreloads = [];
  lightboxCounter.textContent = `${index + 1} / ${photos.length}`;
  lightboxFilename.textContent = photo.filename;
  lightboxImage.alt = `Foto ${index + 1} do ENTEC 2026: ${photo.filename}`;
  lightboxImage.width = photo.width;
  lightboxImage.height = photo.height;
  lightboxImage.src = photo.thumbnail;
  prevButton.disabled = index === 0;
  nextButton.disabled = index === photos.length - 1;
  updateSelection();

  const original = new Image();
  original.onload = () => {
    if (request !== lightboxRequest || !lightbox.open) return;
    lightboxImage.src = photo.original;
    preloadNeighbors(index);
  };
  original.onerror = () => {
    if (request === lightboxRequest && lightbox.open) showToast('O original não carregou. Exibindo a prévia.');
  };
  original.src = photo.original;
}

function openLightbox(index) {
  previousFocus = document.activeElement;
  document.documentElement.classList.add('gallery-lightbox-open');
  document.body.classList.add('gallery-lightbox-open');
  lightbox.showModal();
  showLightboxPhoto(index);
  document.getElementById('gallery-lightbox-close').focus();
}

function closeLightbox({ syncPage = true } = {}) {
  if (lightbox.open) lightbox.close();
  finishClose(syncPage);
}

// Limpeza idempotente e síncrona: o evento "close" do <dialog> é assíncrono
// (e o Chrome o adia com a aba oculta), então não dependemos do seu timing.
function finishClose(syncPage = true) {
  if (lightbox.open || lightboxIndex < 0) return;
  const lastIndex = lightboxIndex;
  ++lightboxRequest;
  lightboxIndex = -1;
  adjacentPreloads = [];
  lightboxImage.removeAttribute('src');
  document.documentElement.classList.remove('gallery-lightbox-open');
  document.body.classList.remove('gallery-lightbox-open');
  // Se o visualizador avançou para outra página, a grade acompanha a última foto vista.
  if (syncPage === true && pageOf(lastIndex) !== page) {
    goToPage(pageOf(lastIndex), { scroll: false });
    const card = grid.querySelector(`.gallery-photo[data-index="${lastIndex}"]`);
    card?.scrollIntoView({ block: 'center' });
    card?.querySelector('.gallery-photo-open')?.focus({ preventScroll: true });
    return;
  }
  previousFocus?.focus?.({ preventScroll: true });
}

// O R2 não envia CORS nem Content-Disposition; por isso o download passa pelo
// endpoint do próprio site, que responde com "attachment" e o nome original.
function downloadUrl(photo) {
  return `${DOWNLOAD_ENDPOINT}?id=${encodeURIComponent(photo.id)}`;
}

function triggerOriginalDownload(photo) {
  const link = document.createElement('a');
  link.href = downloadUrl(photo);
  link.download = photo.filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
}

const downloadSelectedButton = document.getElementById('gallery-download-selected');
const downloadSelectedLabel = downloadSelectedButton.innerHTML;
let preparingZip = false;

function setPreparingZip(active) {
  preparingZip = active;
  downloadSelectedButton.disabled = active;
  downloadSelectedButton.setAttribute('aria-busy', String(active));
  if (active) downloadSelectedButton.textContent = 'Preparando download...';
  else downloadSelectedButton.innerHTML = downloadSelectedLabel;
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
    : `${mb.toLocaleString('pt-BR', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
}

// Um único ZIP montado no servidor a partir dos originais: o navegador recebe um só
// download (attachment) por navegação direta, sem carregar as fotos em memória.
async function downloadSelectedZip(list) {
  if (preparingZip) return;
  setPreparingZip(true);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ZIP_PREPARE_TIMEOUT);
  let info;
  try {
    const response = await fetch(ZIP_PREPARE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: list.map(photo => photo.id) }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error(data.error || 'Não foi possível preparar o arquivo ZIP.');
    info = data;
  } catch (error) {
    clearTimeout(timer);
    setPreparingZip(false);
    const offline = navigator.onLine === false || error.name === 'AbortError' || error instanceof TypeError;
    showToast(offline
      ? 'Falha de conexão ao preparar o download. Verifique a internet e tente novamente.'
      : error.message);
    return;
  }
  clearTimeout(timer);
  window.location.assign(info.url);
  showToast(`Download iniciado: ${info.filename} (${formatBytes(info.bytes)}).`);
  // A navegação para um anexo mantém a página; libera o botão depois que o download começa.
  setTimeout(() => setPreparingZip(false), 2500);
}

grid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || !grid.contains(button)) return;
  const card = button.closest('.gallery-photo');
  const index = Number(card.dataset.index);
  if (button.dataset.action === 'select' || selectionMode) toggleSelection(index);
  else openLightbox(index);
});

modeButton.addEventListener('click', () => {
  selectionMode = !selectionMode;
  updateSelection();
});
document.getElementById('gallery-clear-selection').addEventListener('click', () => {
  selected.clear();
  selectionMode = false;
  updateSelection();
});
downloadSelectedButton.addEventListener('click', () => {
  const list = [...selected].sort((a, b) => a - b).map(index => photos[index]);
  if (list.length) downloadSelectedZip(list);
});
document.getElementById('gallery-lightbox-download').addEventListener('click', () => {
  if (lightboxIndex < 0) return;
  triggerOriginalDownload(photos[lightboxIndex]);
  showToast('Download do original iniciado.');
});
pageList.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-page]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  goToPage(Number(link.dataset.page));
});
window.addEventListener('popstate', () => {
  if (!photos.length) return;
  closeLightbox({ syncPage: false });
  renderPage(pageFromUrl());
  scrollToArchive(false);
});
lightboxSelect.addEventListener('click', () => toggleSelection(lightboxIndex));
document.getElementById('gallery-lightbox-close').addEventListener('click', closeLightbox);
prevButton.addEventListener('click', () => showLightboxPhoto(lightboxIndex - 1));
nextButton.addEventListener('click', () => showLightboxPhoto(lightboxIndex + 1));
lightbox.addEventListener('close', () => finishClose());

document.addEventListener('keydown', (event) => {
  if (!lightbox.open) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); showLightboxPhoto(lightboxIndex - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); showLightboxPhoto(lightboxIndex + 1); }
  if (event.key === 'Escape') { event.preventDefault(); closeLightbox(); }
});

let touchStart = null;
const stage = document.getElementById('gallery-lightbox-stage');
stage.addEventListener('touchstart', (event) => {
  if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
stage.addEventListener('touchend', (event) => {
  if (!touchStart || !event.changedTouches.length) return;
  const dx = event.changedTouches[0].clientX - touchStart.x;
  const dy = event.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  showLightboxPhoto(lightboxIndex + (dx < 0 ? 1 : -1));
}, { passive: true });

const menuButton = document.getElementById('gallery-menu-button');
const menu = document.getElementById('gallery-menu');
function setMenuOpen(open, restoreFocus = false) {
  menu.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  if (restoreFocus) menuButton.focus();
}
menuButton.addEventListener('click', () => setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', () => setMenuOpen(false));
document.addEventListener('click', (event) => { if (!event.target.closest('.cert-header')) setMenuOpen(false); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && menu.classList.contains('open')) setMenuOpen(false, true); });

let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(reflowColumns);
}, { passive: true });

async function loadGallery() {
  try {
    const response = await fetch(new URL('../gallery.json', import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data) || !data.length || data.some(photo =>
      !photo.id || !photo.filename || !photo.thumbnail || !photo.original ||
      !Number.isFinite(photo.width) || !Number.isFinite(photo.height) || photo.width <= 0 || photo.height <= 0)) {
      throw new Error('Manifesto de fotos inválido');
    }
    photos = data;
    totalPages = Math.ceil(photos.length / PAGE_SIZE);
    status.hidden = true;
    const initial = pageFromUrl();
    // Normaliza ?page= inválido ou fora do intervalo sem criar entrada no histórico.
    if (pageUrl(initial) !== location.pathname + location.search) history.replaceState({ page: initial }, '', pageUrl(initial));
    renderPage(initial);
  } catch {
    status.textContent = 'Não foi possível carregar o acervo. Atualize a página e tente novamente.';
    countLabel.textContent = 'Acervo indisponível';
  }
}

loadGallery();
