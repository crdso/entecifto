import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../certificado/config.js';

// Mesma consulta pública de entec/src/lib/standResults.js. Não usa ações de admin.
// Primeiro via /api/resultados (mesma origem, sem depender do CORS da função, que só
// libera o domínio oficial e o ambiente local); se o host não tiver o endpoint, chama direto.
async function parseResponse(res) {
  const text = await res.text().catch(() => '');
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || data?.message || `Falha ao consultar resultados (${res.status}).`);
  return data;
}

async function getPublicResults() {
  try {
    const res = await fetch('/api/resultados', { cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    if (res.status !== 404 && type.includes('application/json')) return parseResponse(res);
  } catch {
    // Sem endpoint same-origin (ex.: servidor estático): tenta a função diretamente.
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Configuração pública indisponível.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/event-results`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'public_status' }),
  });
  return parseResponse(res);
}

const state = document.getElementById('results-state');
const stateTitle = document.getElementById('results-state-title');
const stateDetail = document.getElementById('results-state-detail');
const retry = document.getElementById('results-retry');
const content = document.getElementById('results-content');
const podium = document.getElementById('results-podium');
const scoreFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function setState(kind, title, detail) {
  content.hidden = true;
  content.classList.remove('is-visible');
  state.hidden = false;
  state.dataset.state = kind;
  stateTitle.textContent = title;
  stateDetail.textContent = detail;
  retry.hidden = kind !== 'error';
}

function publishedPodium(data) {
  if (data?.released !== true) return null;
  const entries = [
    { place: 1, name: data.first, score: data.first_score, label: 'Vencedor' },
    { place: 2, name: data.second, score: data.second_score, label: '' },
    { place: 3, name: data.third, score: data.third_score, label: '' },
  ];
  if (entries.some(({ name, score }) =>
    typeof name !== 'string' || !name.trim() || score === null || score === undefined || score === '' || !Number.isFinite(Number(score)))) {
    throw new Error('Resposta oficial incompleta.');
  }
  return entries;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeCard({ place, name, score, label }) {
  const card = element('article', `results-card place-${place}`);
  card.setAttribute('aria-label', `${place}º lugar: ${name}. Nota ${scoreFormatter.format(Number(score))}.`);
  const top = element('div', 'results-card-top');
  const rank = element('div', 'results-card-rank', String(place));
  rank.setAttribute('aria-hidden', 'true');
  rank.append(element('span', 'rank-ordinal', 'º'), element('span', 'rank-word', 'lugar'));
  top.append(rank);
  const bottom = element('div', 'results-card-bottom');
  const line = element('div', 'results-card-line');
  line.setAttribute('aria-hidden', 'true');
  const heading = element('h3', '', name);
  const scoreLine = element('div', 'results-card-score');
  scoreLine.append(element('span', '', 'NOTA'), element('strong', '', scoreFormatter.format(Number(score))));
  bottom.append(line);
  if (label) bottom.append(element('p', 'results-card-label', label));
  bottom.append(heading, scoreLine);
  card.append(top, bottom);
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--glow-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--glow-y', `${event.clientY - rect.top}px`);
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--glow-x');
      card.style.removeProperty('--glow-y');
    });
  }
  return card;
}

let requestId = 0;
let revealObserver;
async function loadResults() {
  const currentRequest = ++requestId;
  setState('loading', 'Consultando o resultado oficial', 'Buscando a classificação publicada pela organização.');
  try {
    const response = await getPublicResults();
    if (currentRequest !== requestId) return;
    const entries = publishedPodium(response);
    if (!entries) {
      setState('pending', 'Resultados ainda não divulgados', 'O pódio aparecerá aqui após a liberação oficial pela organização.');
      return;
    }
    podium.replaceChildren(...entries.map(makeCard));
    state.hidden = true;
    content.hidden = false;
    revealObserver?.disconnect();
    if ('IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver((observed) => {
        if (observed.some((entry) => entry.isIntersecting)) {
          content.classList.add('is-visible');
          revealObserver.disconnect();
        }
      }, { threshold: 0.12 });
      revealObserver.observe(podium);
    } else {
      requestAnimationFrame(() => content.classList.add('is-visible'));
    }
  } catch (error) {
    if (currentRequest !== requestId) return;
    console.error('Resultados:', error);
    setState('error', 'Não foi possível carregar', navigator.onLine === false
      ? 'Você parece estar sem internet. Verifique sua conexão e tente novamente.'
      : 'O serviço de resultados não respondeu. Tente novamente em instantes.');
  }
}

retry.addEventListener('click', loadResults);
loadResults();

const menuButton = document.getElementById('results-menu-button');
const menu = document.getElementById('results-menu');
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
