// Painel administrativo do ENTEC 2026.
// Mesmas regras do painel anterior (entec/src/pages/Admin.jsx): login Supabase com o e-mail
// de ADMIN_EMAIL, leitura das tabelas via RLS de "authenticated" e todas as alterações
// sensíveis pelas Edge Functions já publicadas (event-checkin, event-certificate-admin,
// event-wallet, event-results). Nenhuma chave de serviço no navegador.
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL } from '/env.js';

const $ = (id) => document.getElementById(id);
const brl = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = (n) => String(n).padStart(2, '0');
function formatDate(iso, withYear = true, withSeconds = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = withYear ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? `:${pad(d.getSeconds())}` : ''}`;
}
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
function show(node, message) {
  node.hidden = !message;
  node.textContent = message || '';
}

// ---------------------------------------------------------------- Estado
const state = {
  session: null,
  tab: 'inscricoes',
  rows: [], rowsLoading: true, filter: 'todos', search: '',
  participantes: [], partLoading: false, partSearch: '',
  visitas: [], visLoading: false,
  regOpen: true, regLoading: false, regMissing: false,
  updating: null, copied: null,
  bulkRunning: false, bulkProgress: null,
};
let supabase = null;
let channel = null;

const adminEmail = (ADMIN_EMAIL || '').trim().toLowerCase();
const isAllowed = (user) => Boolean(adminEmail) && (user?.email || '').trim().toLowerCase() === adminEmail;
const deniedMessage = () => adminEmail
  ? 'Acesso restrito. Esta conta não tem permissão para o painel administrativo.'
  : 'Painel administrativo não configurado.';

function setError(message) { show($('admin-error'), message); }

// ---------------------------------------------------------------- REST / Functions
function headers(json = false) {
  const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${state.session?.access_token || SUPABASE_ANON_KEY}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
async function rest(method, table, query = '', body, prefer) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: { ...headers(Boolean(body)), ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const verb = { GET: 'listar', PATCH: 'atualizar', DELETE: 'deletar', POST: 'salvar' }[method];
    throw new Error(`Falha ao ${verb} (${res.status}). ${text}`);
  }
  return method === 'DELETE' ? true : res.json();
}
async function callFunction(name, payload) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST', headers: headers(true), body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// ---------------------------------------------------------------- Inscrições (camisas)
const FILTER_LABEL = { todos: 'Todos', pending_payment: 'Pendentes', pago: 'Pagos' };
const STATUS_LABEL = { pago: 'Pago', pending_payment: 'Pendente' };
// Nome estampado na camisa: o escolhido ou o primeiro nome.
const shirtName = (r) => (r.nome_camisa || '').trim() || (r.nome || '').trim().split(/\s+/)[0] || '—';
// Taxas MP conforme tabela da organização — para bater exato com R$ 393,81.
function feeInfo(valor, method) {
  const v = Number(valor) || 0;
  const m = (method || '').toLowerCase();
  let taxa;
  if (m === 'pix') taxa = v * 0.0099;
  else if (m === 'account_money') taxa = v * 0.0499;
  else if (m.includes('ticket') || m.includes('bol')) taxa = 3.49;
  else if (m.includes('debit')) taxa = v * 0.0399;
  else if (m.includes('credit')) taxa = v * 0.0499;
  else taxa = v * 0.0099;
  const taxaR = Number(taxa.toFixed(2));
  return { taxa: taxaR, liquido: Number((v - taxaR).toFixed(2)) };
}
const paymentLabel = (r) => r.status !== 'pago' ? '—'
  : r.payment_method === 'pix' ? 'Pix' : r.payment_method === 'account_money' ? 'Conta MP' : (r.payment_method || '—');

function filteredRows() {
  const q = state.search.trim().toLowerCase();
  return state.rows.filter((r) => (state.filter === 'todos' || r.status === state.filter)
    && (!q || (r.nome || '').toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q)));
}
function financeiro() {
  const pagos = state.rows.filter((r) => r.status === 'pago');
  let bruto = 0, taxas = 0, liquido = 0;
  pagos.forEach((r) => { const f = feeInfo(r.valor, r.payment_method); bruto += Number(r.valor) || 0; taxas += f.taxa; liquido += f.liquido; });
  const rendimentos = 0.14; // do extrato MP (21/08 0,04 + 20/08 0,05 + 19/08 0,05)
  return { bruto: Number(bruto.toFixed(2)), taxas: Number(taxas.toFixed(2)), liquido: Number(liquido.toFixed(2)), rendimentos, saldo: Number((liquido + rendimentos).toFixed(2)), qtd: pagos.length };
}

async function loadRows() {
  state.rowsLoading = true; renderInscricoes();
  setError('');
  try { state.rows = (await rest('GET', 'inscricoes', 'order=created_at.desc&limit=1000')) || []; }
  catch (e) { setError(e.message || 'Falha ao carregar inscrições.'); state.rows = []; }
  state.rowsLoading = false; renderInscricoes();
}

function stat(label, value, extra) {
  return el('div', { class: 'admin-stat' }, el('span', { text: label }), el('strong', { text: String(value) }), extra);
}
function renderInscricoes() {
  const rows = state.rows;
  $('insc-stats').replaceChildren(
    stat('Total de inscrições', rows.length),
    stat('Pagamentos aprovados', rows.filter((r) => r.status === 'pago').length),
    stat('Pagamentos pendentes', rows.filter((r) => r.status === 'pending_payment').length),
    stat('Camisas entregues', rows.filter((r) => r.delivered).length),
  );
  const f = financeiro();
  $('insc-finance').replaceChildren(
    ...[[`Bruto (${f.qtd} pagos)`, brl(f.bruto)], ['Taxas MP', `- ${brl(f.taxas)}`], ['Líquido vendas', brl(f.liquido)],
      ['Rendimentos', `+ ${brl(f.rendimentos)}`], ['Saldo em conta', brl(f.saldo)]]
      .map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v }))),
  );
  renderRegToggle();
  document.querySelectorAll('#insc-filters button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));

  const wrap = $('insc-table');
  if (state.rowsLoading) { wrap.replaceChildren(el('div', { class: 'admin-empty' }, el('span', { class: 'admin-spinner' }))); return; }
  const list = filteredRows();
  if (!list.length) { wrap.replaceChildren(el('div', { class: 'admin-empty', text: 'Nenhuma inscrição encontrada.' })); return; }
  const head = ['Nome', 'Nome camisa', 'Telefone', 'E-mail', 'Tam.', 'Gênero', 'Valor', 'Pagto', 'Líquido', 'Data', 'Status', 'Entrega', 'Ação'];
  wrap.replaceChildren(el('table', { class: 'admin-table' },
    el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))),
    el('tbody', {}, list.map((r) => {
      const busy = state.updating === r.id;
      return el('tr', {},
        el('td', { class: 'admin-strong', text: r.nome }),
        el('td', { text: shirtName(r) }),
        el('td', { class: 'admin-nowrap', text: r.telefone }),
        el('td', { text: r.email }),
        el('td', { text: r.tamanho }),
        el('td', { text: r.genero || '—' }),
        el('td', { class: 'admin-nowrap', text: brl(r.valor) }),
        el('td', { title: r.payment_method || '', text: paymentLabel(r) }),
        el('td', { class: 'admin-nowrap', text: r.status === 'pago' ? brl(feeInfo(r.valor, r.payment_method).liquido) : '—' }),
        el('td', { class: 'admin-nowrap', text: formatDate(r.created_at) }),
        el('td', {}, el('span', { class: `admin-badge ${r.status === 'pago' ? 'is-ok' : r.status === 'pending_payment' ? 'is-warn' : ''}`, text: STATUS_LABEL[r.status] || r.status })),
        el('td', {}, el('span', { class: `admin-badge ${r.delivered ? 'is-ok' : ''}`, text: r.delivered ? 'Entregue' : 'Não entregue' })),
        el('td', {}, el('div', { class: 'admin-row-actions' },
          r.status === 'pago' && !r.delivered && el('button', { class: 'admin-chip', type: 'button', disabled: busy, onclick: () => markDelivered(r), text: busy ? 'Salvando…' : 'Marcar como entregue' }),
          r.delivered && el('span', { class: 'admin-muted', text: '—' }),
          el('button', { class: 'admin-chip', type: 'button', onclick: () => copyRow(r, 'full'), text: state.copied === `${r.id}:full` ? 'Copiado' : 'Copiar' }),
          el('button', { class: 'admin-chip', type: 'button', onclick: () => copyRow(r, 'mini'), text: state.copied === `${r.id}:mini` ? 'Copiado' : 'Copiar 2' }),
          el('button', { class: 'admin-chip is-danger', type: 'button', disabled: busy, title: 'Deletar inscrição', onclick: () => deleteRow(r), text: 'Deletar' }),
        )),
      );
    })),
  ));
}

async function copyRow(r, mode) {
  const lines = mode === 'mini'
    ? [`apelido camisa: ${shirtName(r)}`, `tamanho: ${r.tamanho}`]
    : [`nome da pessoa: ${r.nome}`, `apelido camisa: ${shirtName(r)}`, `tamanho: ${r.tamanho}`, `telefone: ${r.telefone}`];
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    state.copied = `${r.id}:${mode}`; renderInscricoes();
    setTimeout(() => { state.copied = null; renderInscricoes(); }, 1600);
  } catch { setError('Não foi possível copiar.'); }
}
async function markDelivered(r) {
  state.updating = r.id; setError(''); renderInscricoes();
  try { await rest('PATCH', 'inscricoes', `id=eq.${encodeURIComponent(r.id)}`, { delivered: true }, 'return=representation'); await loadRows(); }
  catch (e) { setError(e.message || 'Falha ao marcar como entregue.'); }
  state.updating = null; renderInscricoes();
}
async function deleteRow(r) {
  if (!window.confirm(`Deletar a inscrição de "${r.nome}" (${r.email})?\nEsta ação não pode ser desfeita.`)) return;
  state.updating = r.id; setError(''); renderInscricoes();
  try { await rest('DELETE', 'inscricoes', `id=eq.${encodeURIComponent(r.id)}`); state.rows = state.rows.filter((x) => x.id !== r.id); }
  catch (e) { setError(e.message || 'Falha ao deletar.'); }
  state.updating = null; renderInscricoes();
}

// Inscrições abertas/fechadas (event_settings.registrations_open)
async function loadRegSettings() {
  state.regLoading = true; renderRegToggle();
  try {
    const data = await rest('GET', 'event_settings', 'key=eq.registrations_open&select=value');
    if (Array.isArray(data) && data.length) { state.regOpen = String(data[0].value ?? 'true').toLowerCase() !== 'false'; state.regMissing = false; }
    else { state.regOpen = true; state.regMissing = true; }
  } catch { state.regOpen = true; state.regMissing = true; }
  state.regLoading = false; renderRegToggle();
}
function renderRegToggle() {
  $('reg-state').replaceChildren(el('span', { class: `admin-badge ${state.regOpen ? 'is-ok' : 'is-danger'}`, text: state.regLoading ? 'Carregando…' : state.regOpen ? 'Inscrições abertas' : 'Inscrições fechadas' }));
  const button = $('reg-toggle');
  button.disabled = state.updating === 'reg-toggle' || state.regLoading;
  button.textContent = state.updating === 'reg-toggle' ? 'Salvando…' : state.regOpen ? 'Fechar inscrições' : 'Reabrir inscrições';
  $('reg-missing').hidden = !state.regMissing;
}
async function toggleRegistrations() {
  if (state.updating) return;
  const next = !state.regOpen;
  if (!window.confirm(next ? 'Reabrir as inscrições para o público no site?'
    : 'Fechar as inscrições? O site passa a mostrar “Inscrições encerradas” e novas inscrições são bloqueadas.')) return;
  state.updating = 'reg-toggle'; setError(''); renderRegToggle();
  try {
    const value = next ? 'true' : 'false';
    const updated = await rest('PATCH', 'event_settings', 'key=eq.registrations_open', { value }, 'return=representation');
    if (!Array.isArray(updated) || !updated.length) {
      // Tabela existe mas a linha ainda não (seed não rodado): cria.
      try { await rest('POST', 'event_settings', '', { key: 'registrations_open', value }, 'return=representation'); }
      catch { throw new Error('Tabela event_settings não encontrada. Rode supabase/event_settings.sql no SQL Editor do Supabase.'); }
    }
    state.regOpen = next; state.regMissing = false;
  } catch (e) { setError(e.message || 'Falha ao alternar inscrições.'); }
  state.updating = null; renderRegToggle();
}

// PDF das inscrições (mesmo conteúdo do painel anterior)
function downloadPdf(tipo) {
  const list = filteredRows().length ? filteredRows() : state.rows;
  if (!list.length) { setError('Nenhum dado para exportar.'); return; }
  const { jsPDF } = window.jspdf;
  const resumido = tipo === 'resumido';
  const doc = new jsPDF();
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(resumido ? 'ENTEC 2026 — Lista Resumida' : 'ENTEC 2026 — Lista Completa', 14, 18);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} • ${list.length} pedidos • Filtro: ${FILTER_LABEL[state.filter]}${state.search ? ` • Busca: "${state.search}"` : ''}`, 14, 24);
  if (!resumido) {
    const f = financeiro();
    doc.text(`Bruto ${brl(f.bruto)} • Taxas ${brl(f.taxas)} • Líquido ${brl(f.liquido)} • Saldo ${brl(f.saldo)} • Rend. ${brl(f.rendimentos)}`, 14, 30);
  }
  let y = resumido ? 32 : 36;
  const pageH = doc.internal.pageSize.getHeight();
  list.forEach((r, idx) => {
    if (y > pageH - 22) { doc.addPage(); y = 18; }
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
    doc.text(`${idx + 1}. ${r.nome}`, 14, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60);
    const base = [`nome: ${r.nome}`, `nome camisa: ${shirtName(r)}`, `genero: ${r.genero || '—'}`, `tamanho: ${r.tamanho}`];
    const lines = resumido ? base : [...base, `telefone: ${r.telefone}`, `email: ${r.email}`,
      `valor: ${brl(r.valor)} • pagamento: ${r.payment_method ? (r.payment_method === 'pix' ? 'Pix' : r.payment_method === 'account_money' ? 'Conta MP' : r.payment_method) : '—'} • status: ${STATUS_LABEL[r.status] || r.status} • liquido: ${r.status === 'pago' ? brl(feeInfo(r.valor, r.payment_method).liquido) : '—'}`,
      `data: ${formatDate(r.created_at)}`];
    lines.forEach((line) => doc.splitTextToSize(`- ${line}`, 182).forEach((s) => {
      if (y > pageH - 12) { doc.addPage(); y = 14; }
      doc.text(s, 16, y); y += 4.5;
    }));
    y += 2; doc.setDrawColor(220); doc.line(14, y, 196, y); y += 6;
  });
  doc.save(`entec2026-${resumido ? 'resumido' : 'completo'}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ---------------------------------------------------------------- Participantes (event_registrations)
function filteredParticipantes() {
  const q = state.partSearch.trim().toLowerCase();
  return q ? state.participantes.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)) : state.participantes;
}
async function loadParticipantes() {
  state.partLoading = true; show($('part-error'), ''); renderParticipantes();
  try {
    state.participantes = (await rest('GET', 'event_registrations',
      'select=id,name,email,cpf_last4,created_at,attendance_confirmed,attendance_confirmed_at,attendance_confirmed_by,wallet_status,wallet_created_at,certificate_ready&order=created_at.desc&limit=1000')) || [];
  } catch (e) {
    const msg = e.message || '';
    show($('part-error'), msg.includes('event_registrations') || msg.includes('42P01') || msg.includes('404')
      ? 'Tabela event_registrations ainda não criada. Rode supabase/event_registrations.sql no SQL Editor do Supabase.'
      : msg || 'Falha ao carregar participantes.');
    state.participantes = [];
  }
  state.partLoading = false; renderParticipantes();
}
function renderParticipantes() {
  const total = state.participantes.length;
  const confirmados = state.participantes.filter((p) => p.attendance_confirmed).length;
  const count = $('tab-count-participantes');
  count.hidden = total === 0; count.textContent = String(total);
  $('part-stats').replaceChildren(stat('Total de inscritos', total), stat('Presenças confirmadas', confirmados), stat('Pendentes', total - confirmados));
  const bulk = $('part-bulk');
  bulk.disabled = state.bulkRunning || state.partLoading || total === 0;
  bulk.textContent = state.bulkRunning && state.bulkProgress ? `Processando ${state.bulkProgress.done}/${state.bulkProgress.total}…` : 'Presença + certificado (todos)';
  $('part-refresh').disabled = state.partLoading;

  const wrap = $('part-table');
  if (state.partLoading) { wrap.replaceChildren(el('div', { class: 'admin-empty' }, el('span', { class: 'admin-spinner' }))); return; }
  const list = filteredParticipantes();
  if (!list.length) { wrap.replaceChildren(el('div', { class: 'admin-empty', text: 'Nenhum participante encontrado.' })); return; }
  const head = ['Nome', 'E-mail', 'CPF', 'Inscrição', 'Presença', 'Credencial', 'Certificado', 'Ação'];
  wrap.replaceChildren(el('table', { class: 'admin-table' },
    el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))),
    el('tbody', {}, list.map((p) => {
      const busy = state.updating === p.id;
      const last4 = String(p.cpf_last4 || '');
      const wallet = p.wallet_status === 'ready' ? ['is-ok', 'Pronta'] : p.wallet_status === 'error' ? ['is-danger', 'Erro'] : ['is-warn', 'Pendente'];
      return el('tr', {},
        el('td', { class: 'admin-strong', text: p.name }),
        el('td', { text: p.email }),
        el('td', { class: 'admin-nowrap', title: `Final ${last4}` }, `•••.•••.${last4.slice(0, 1)}-${last4.slice(1)}`, el('span', { class: 'admin-muted', text: ` Final ${last4}` })),
        el('td', { class: 'admin-nowrap', text: formatDate(p.created_at) }),
        el('td', {}, el('span', { class: `admin-badge ${p.attendance_confirmed ? 'is-ok' : 'is-warn'}`, text: p.attendance_confirmed ? 'Confirmada' : 'Pendente' })),
        el('td', {}, el('div', { class: 'admin-row-actions' },
          el('span', { class: `admin-badge ${wallet[0]}`, text: wallet[1] }),
          p.wallet_status === 'error' && el('button', { class: 'admin-chip', type: 'button', disabled: busy, title: 'Tentar gerar novamente', onclick: () => retryWallet(p), text: 'Tentar novamente' }))),
        el('td', {}, el('div', { class: 'admin-row-actions' },
          el('span', { class: `admin-badge ${p.certificate_ready ? 'is-ok' : ''}`, text: p.certificate_ready ? 'Liberado' : 'Não liberado' }),
          el('button', { class: 'admin-chip', type: 'button', disabled: busy, onclick: () => toggleCertificate(p), text: p.certificate_ready ? 'Remover' : 'Liberar' }))),
        el('td', {}, el('div', { class: 'admin-row-actions' },
          el('button', { class: `admin-chip ${p.attendance_confirmed ? '' : 'is-primary'}`, type: 'button', disabled: busy, onclick: () => toggleAttendance(p), text: p.attendance_confirmed ? 'Remover presença' : 'Confirmar presença' }),
          el('button', { class: 'admin-chip is-danger', type: 'button', disabled: busy, title: 'Remover participante', onclick: () => deleteParticipante(p), text: 'Remover' }))),
      );
    })),
  ));
}
function patchParticipante(id, patch) {
  state.participantes = state.participantes.map((x) => (x.id === id ? { ...x, ...patch } : x));
}
async function withRow(p, task, fallbackMessage) {
  state.updating = p.id; setError(''); renderParticipantes();
  try { await task(); } catch (e) { setError(e.message || fallbackMessage); }
  state.updating = null; renderParticipantes();
}
function toggleAttendance(p) {
  return withRow(p, async () => {
    const action = p.attendance_confirmed ? 'manual_remove' : 'manual_confirm';
    const { res, data } = await callFunction('event-checkin', { action, registration_id: p.id });
    if (!res.ok) throw new Error(data.error || `Falha ao atualizar presença (${res.status})`);
    const participant = data.participant || {};
    patchParticipante(p.id, {
      attendance_confirmed: participant.attendance_confirmed ?? (action === 'manual_confirm'),
      attendance_confirmed_at: participant.attendance_confirmed_at ?? null,
      attendance_confirmed_by: participant.attendance_confirmed_by ?? null,
    });
  }, 'Falha ao atualizar presença.');
}
function deleteParticipante(p) {
  if (!window.confirm(`Remover participante "${p.name}" (${p.email})?\nEsta ação não pode ser desfeita.`)) return;
  return withRow(p, async () => {
    const { res, data } = await callFunction('event-checkin', { action: 'manual_delete', registration_id: p.id });
    if (!res.ok) throw new Error(data.error || `Falha ao remover participante (${res.status})`);
    state.participantes = state.participantes.filter((x) => x.id !== p.id);
  }, 'Falha ao remover participante.');
}
function retryWallet(p) {
  return withRow(p, async () => {
    const { res, data } = await callFunction('event-wallet', { registration_id: p.id });
    if (!res.ok) throw new Error(data.error || `Falha ao gerar credencial (${res.status})`);
    await loadParticipantes();
  }, 'Falha ao tentar gerar novamente.');
}
function toggleCertificate(p) {
  return withRow(p, async () => {
    const enabled = !p.certificate_ready;
    const { res, data } = await callFunction('event-certificate-admin', { registration_id: p.id, enabled });
    if (!res.ok) throw new Error(data.error || `Falha ao ${enabled ? 'liberar' : 'remover'} certificado (${res.status})`);
    patchParticipante(p.id, { certificate_ready: enabled });
  }, 'Falha ao atualizar certificado.');
}

// Ação em massa: confirma presença dos pendentes e libera certificado dos não liberados,
// reaproveitando os mesmos endpoints individuais (event-checkin + event-certificate-admin).
async function bulkConfirmAndRelease() {
  if (state.bulkRunning) return;
  const presenca = state.participantes.filter((p) => !p.attendance_confirmed);
  const certificados = state.participantes.filter((p) => !p.certificate_ready);
  const total = presenca.length + certificados.length;
  const result = $('part-bulk-result');
  if (!total) { show(result, 'Tudo certo: todos já têm presença confirmada e certificado liberado.'); return; }
  if (!window.confirm(`Confirmar presença de ${presenca.length} participante(s) e liberar certificado de ${certificados.length}?\nTotal de ${total} atualizações.\nDá para desfazer individualmente depois, se precisar.`)) return;
  state.bulkRunning = true; state.bulkProgress = { done: 0, total }; show(result, ''); setError(''); renderParticipantes();
  const failures = [];
  const runPool = async (items, task) => {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(4, Math.max(items.length, 1)) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        try { await task(item); } catch (e) { failures.push(`${item.name || item.email || item.id}: ${e.message || 'erro'}`); }
        state.bulkProgress.done += 1; renderParticipantes();
      }
    }));
  };
  const call = async (name, payload) => { const { res, data } = await callFunction(name, payload); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`); };
  try {
    await runPool(presenca, (p) => call('event-checkin', { action: 'manual_confirm', registration_id: p.id }));
    await runPool(certificados, (p) => call('event-certificate-admin', { registration_id: p.id, enabled: true }));
    await loadParticipantes();
    show(result, failures.length === 0
      ? `Concluído: ${presenca.length} presença(s) confirmada(s) e ${certificados.length} certificado(s) liberado(s).`
      : `Concluído com ${failures.length} falha(s): ${failures.slice(0, 5).join(' • ')}${failures.length > 5 ? '…' : ''}`);
  } catch (e) { setError(e.message || 'Falha na ação em massa.'); }
  state.bulkRunning = false; state.bulkProgress = null; renderParticipantes();
}

function exportCsv() {
  const list = filteredParticipantes();
  if (!list.length) { setError('Nenhum participante para exportar.'); return; }
  const quote = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
  const csv = ['nome,email,cpf_last4,attendance_confirmed,created_at',
    ...list.map((p) => [quote(p.name), quote(p.email), p.cpf_last4 || '', p.attendance_confirmed ? 'true' : 'false', p.created_at ? new Date(p.created_at).toISOString() : ''].join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = el('a', { href: url, download: `entec2026-participantes-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------- Visitas
async function loadVisitas() {
  state.visLoading = true; show($('vis-error'), ''); renderVisitas();
  try { state.visitas = (await rest('GET', 'visitas', 'order=created_at.desc&limit=200')) || []; }
  catch (e) {
    const msg = e.message || '';
    show($('vis-error'), msg.includes('visitas') || msg.includes('42P01') || msg.includes('404')
      ? 'Tabela visitas ainda não criada. Rode o schema.sql no SQL Editor do Supabase.' : msg || 'Falha ao carregar visitas.');
    state.visitas = [];
  }
  state.visLoading = false; renderVisitas();
}
function renderVisitas() {
  const now = Date.now();
  const today = new Date().toDateString();
  const v = state.visitas;
  const online = v.filter((x) => now - new Date(x.created_at).getTime() < 5 * 60 * 1000).length;
  $('vis-stats').replaceChildren(
    stat('Total de acessos', v.length),
    stat('Hoje', v.filter((x) => new Date(x.created_at).toDateString() === today).length),
    stat('Online (5 min)', online, online > 0 ? el('i', { class: 'admin-live', 'aria-label': 'ao vivo' }) : null),
    stat('IPs únicos', new Set(v.map((x) => x.ip).filter(Boolean)).size),
  );
  $('vis-refresh').disabled = state.visLoading;
  const wrap = $('vis-table');
  if (state.visLoading) { wrap.replaceChildren(el('div', { class: 'admin-empty' }, el('span', { class: 'admin-spinner' }))); return; }
  if (!v.length) { wrap.replaceChildren(el('div', { class: 'admin-empty', text: 'Nenhum acesso registrado ainda.' })); return; }
  const host = (ref) => { try { return new URL(ref).hostname; } catch { return ref || '—'; } };
  wrap.replaceChildren(el('table', { class: 'admin-table' },
    el('thead', {}, el('tr', {}, ['Horário', 'Página', 'IP', 'Origem', 'Navegador'].map((h) => el('th', { text: h })))),
    el('tbody', {}, v.map((x) => el('tr', {},
      el('td', { class: 'admin-nowrap', text: formatDate(x.created_at, false, true) }),
      el('td', { text: x.path || '/' }),
      el('td', { class: 'admin-nowrap', text: x.ip || '—' }),
      el('td', { title: x.referrer || '', text: x.referrer ? host(x.referrer) : '—' }),
      el('td', { class: 'admin-ua', title: x.user_agent || '', text: x.user_agent || '—' }),
    ))),
  ));
}

// Realtime: visitas novas e atualizações seguras de participantes, conforme a aba aberta.
function subscribeRealtime() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
  if (!state.session) return;
  if (state.tab === 'visitas') {
    channel = supabase.channel('visitas-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visitas' }, (payload) => {
        state.visitas = [payload.new, ...state.visitas].slice(0, 200); renderVisitas();
      }).subscribe();
  } else if (state.tab === 'participantes') {
    channel = supabase.channel('event-registrations-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_registrations' }, (payload) => {
        const u = payload.new;
        if (!u?.id) return;
        // Só colunas seguras entram no estado.
        patchParticipante(u.id, {
          attendance_confirmed: u.attendance_confirmed, attendance_confirmed_at: u.attendance_confirmed_at,
          attendance_confirmed_by: u.attendance_confirmed_by, wallet_status: u.wallet_status,
          wallet_created_at: u.wallet_created_at, certificate_ready: u.certificate_ready, updated_at: u.updated_at,
        });
        renderParticipantes();
      }).subscribe();
  }
}

// ---------------------------------------------------------------- Resultados dos stands
// Mesmos grupos e escala da função event-results publicada.
const STAND_GROUPS = ['Biotech', 'Estação meteorológica', 'Futuro da IA', 'Inclusão Digital', 'Play Connect',
  'Evolução dos Computadores', 'Cybersegurança', 'Casas Inteligentes', 'Cidades Inteligentes', 'Casas em 2030'];
const MAX_SCORE = 100;
const results = { loaded: false, loading: false, notas: {}, released: false, releasedAt: null, saving: false, releasing: false };
const formatScore = (n) => Number.isFinite(Number(n)) ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '—';
function parseNota(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= MAX_SCORE ? Math.round(n * 100) / 100 : null;
}
const parsedScores = () => Object.fromEntries(STAND_GROUPS.map((g) => [g, parseNota(results.notas[g])]));
function ranking(scores) {
  return STAND_GROUPS.filter((g) => Number.isFinite(scores[g])).map((g) => ({ group: g, score: scores[g] }))
    .sort((a, b) => b.score - a.score || a.group.localeCompare(b.group, 'pt-BR'));
}
async function postResults(payload) {
  const { res, data } = await callFunction('event-results', payload);
  if (!res.ok) throw new Error(data?.error || data?.message || `Falha ao consultar resultados (${res.status}).`);
  return data;
}
async function loadResults() {
  results.loading = true; renderResults();
  show($('res-error'), '');
  try {
    const data = await postResults({ action: 'admin_get' });
    const saved = data.scores || {};
    results.notas = Object.fromEntries(STAND_GROUPS.map((g) => [g, saved[g] !== undefined && saved[g] !== null ? String(saved[g]) : '']));
    results.released = Boolean(data.results_released);
    results.releasedAt = data.released_at || null;
    results.loaded = true;
  } catch (e) { show($('res-error'), e.message || 'Falha ao carregar resultados.'); }
  results.loading = false; renderResults();
}
function renderResults() {
  const scores = parsedScores();
  const filled = STAND_GROUPS.filter((g) => scores[g] !== null).length;
  const complete = filled === STAND_GROUPS.length;
  const busy = results.saving || results.releasing || results.loading;
  const released = results.releasedAt ? new Date(results.releasedAt) : null;
  $('res-state').replaceChildren(results.released
    ? el('p', { class: 'admin-alert admin-alert-ok' }, 'RESULTADOS DIVULGADOS ✓ · Divulgado em: ',
      released && !Number.isNaN(released.getTime()) ? `${released.toLocaleDateString('pt-BR')} às ${released.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—')
    : el('p', { class: 'admin-note', text: complete ? 'Notas prontas. Salve e libere manualmente no horário oficial.' : `Faltam ${STAND_GROUPS.length - filled} de ${STAND_GROUPS.length} notas para completar.` }));
  const grid = $('res-scores');
  if (!grid.childElementCount) {
    grid.replaceChildren(...STAND_GROUPS.map((g, i) => el('label', { class: 'admin-score', for: `nota-${i}` },
      el('span', { text: g }),
      el('input', { id: `nota-${i}`, type: 'number', min: '0', max: String(MAX_SCORE), step: '0.1', inputmode: 'decimal', placeholder: `0–${MAX_SCORE}`,
        oninput: (event) => { results.notas[g] = event.target.value; renderResults(); } }))));
  }
  STAND_GROUPS.forEach((g, i) => {
    const input = $(`nota-${i}`);
    if (document.activeElement !== input) input.value = results.notas[g] || '';
    input.disabled = busy;
  });
  const list = ranking(scores);
  $('res-ranking').replaceChildren(...(list.length ? list.map((r, i) => el('li', { class: i < 3 ? 'is-top' : '' },
    el('span', {}, el('b', { text: String(i + 1) }), r.group), el('span', { text: formatScore(r.score) })))
    : [el('li', { class: 'admin-muted', text: 'Digite as notas para ver o pódio se formando aqui.' })]));
  $('res-save').disabled = !complete || busy;
  $('res-save').textContent = results.saving ? 'Salvando…' : 'Salvar notas';
  $('res-release').hidden = results.released;
  $('res-release').disabled = !complete || busy;
}
async function saveResults() {
  if (results.saving) return;
  show($('res-error'), ''); show($('res-notice'), '');
  if (results.released && !window.confirm('Os resultados já foram divulgados. Alterar as notas modificará uma informação pública. Deseja continuar?')) return;
  results.saving = true; renderResults();
  try {
    const data = await postResults({ action: 'save_scores', scores: parsedScores() });
    results.released = Boolean(data.results_released ?? results.released);
    results.releasedAt = data.released_at ?? results.releasedAt;
    const resumo = (data.ranking || []).slice(0, 3).map((x, i) => `${i + 1}º ${x.group} (${formatScore(x.score)})`).join(' · ');
    show($('res-notice'), results.released
      ? `Notas atualizadas e nova versão publicada — ${resumo}.`
      : `Notas salvas. Classificação: ${resumo}. Ainda NÃO está visível ao público — use “Liberar resultados” na hora oficial.`);
  } catch (e) { show($('res-error'), e.message || 'Falha ao salvar as notas.'); }
  results.saving = false; renderResults();
}
function openReleaseConfirm() {
  $('res-confirm-podium').replaceChildren(...ranking(parsedScores()).slice(0, 3).map((t, i) => el('p', { text: `${i + 1}º — ${t.group} (${formatScore(t.score)})` })));
  $('res-confirm').showModal();
}
async function releaseResults() {
  $('res-confirm').close();
  show($('res-error'), ''); show($('res-notice'), '');
  results.releasing = true; renderResults();
  try {
    const data = await postResults({ action: 'release' });
    results.released = true; results.releasedAt = data.released_at || new Date().toISOString();
    show($('res-notice'), 'Resultados divulgados oficialmente. A página /resultados agora exibe o pódio com as notas.');
  } catch (e) { show($('res-error'), e.message || 'Falha ao liberar os resultados.'); }
  results.releasing = false; renderResults();
}

// ---------------------------------------------------------------- Credenciamento por QR
const TICKET = /^ENTEC26-[A-F0-9]{12}$/;
const scanner = { reader: null, controls: null, stream: null, processing: false, pending: null, active: null, recent: new Map(), audio: null, feedbackTimer: 0, session: 0, torch: false };
const vibrate = (pattern) => { try { navigator.vibrate?.(pattern); } catch { /* sem vibração */ } };
function beep() {
  try {
    const ctx = scanner.audio || (scanner.audio = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 880; gain.gain.value = 0.12;
    osc.connect(gain); gain.connect(ctx.destination); osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12); osc.stop(ctx.currentTime + 0.12);
  } catch { /* sem áudio */ }
}
function feedback(type, message, name) {
  const box = $('scanner-feedback');
  box.hidden = false; box.dataset.type = type;
  box.replaceChildren(name ? el('strong', { text: name }) : '', el('span', { text: message }));
  clearTimeout(scanner.feedbackTimer);
  scanner.feedbackTimer = setTimeout(() => { box.hidden = true; }, 1800);
}
function drainQueue() {
  const next = scanner.pending; scanner.pending = null;
  const session = scanner.session;
  if (next && $('scanner').open) setTimeout(() => { if (scanner.session === session) processTicket(next); }, 50);
}
function markRecent(key, now) {
  scanner.recent.set(key, now);
  for (const [k, ts] of scanner.recent) if (now - ts > 10000) scanner.recent.delete(k);
}
function invalidScan(text) {
  const now = Date.now(); const key = `invalid:${text.slice(0, 30)}`;
  const last = scanner.recent.get(key);
  if (last && now - last < 3000) return;
  markRecent(key, now); feedback('invalid', 'QR não reconhecido'); vibrate(100);
}
function queueTicket(raw) {
  const tid = raw.trim().toUpperCase();
  if (!TICKET.test(tid)) { invalidScan(tid); return; }
  if (tid === scanner.active || tid === scanner.pending) return;
  const last = scanner.recent.get(tid);
  if (last && Date.now() - last < 4000) return;
  if (scanner.processing) { if (!scanner.pending) scanner.pending = tid; }
  else processTicket(tid);
}
async function processTicket(tid) {
  const session = scanner.session;
  const now = Date.now();
  const last = scanner.recent.get(tid);
  if (last && now - last < 4000) { drainQueue(); return; }
  scanner.processing = true; scanner.active = tid; markRecent(tid, now);
  try {
    const { res, data } = await callFunction('event-checkin', { action: 'confirm', ticket_id: tid });
    if (scanner.session !== session) return;
    if (!res.ok) {
      if (res.status === 404) feedback('notfound', 'Credencial não encontrada');
      else feedback('error', data.error || 'Falha ao confirmar');
      vibrate(100);
      return;
    }
    const participant = data.participant;
    const name = participant?.name || tid;
    if (data.status === 'already_confirmed') {
      const when = participant?.attendance_confirmed_at ? new Date(participant.attendance_confirmed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      feedback('already', when ? `Já credenciado às ${when}` : 'Já credenciado', name); vibrate(60);
    } else {
      feedback('confirmed', 'Presença confirmada', name); vibrate([60, 30, 60]); beep();
      if (participant?.id) { patchParticipante(participant.id, { attendance_confirmed: true, attendance_confirmed_at: participant.attendance_confirmed_at }); renderParticipantes(); }
    }
  } catch {
    if (scanner.session === session) { feedback('error', 'Falha de conexão'); vibrate(100); }
  } finally {
    if (scanner.session === session) { scanner.processing = false; scanner.active = null; drainQueue(); }
  }
}
function stopCamera() {
  try { scanner.controls?.stop?.(); } catch { /* já parado */ }
  scanner.controls = null; scanner.reader = null;
  const video = $('scanner-video');
  (scanner.stream || video.srcObject)?.getTracks?.().forEach((t) => t.stop());
  scanner.stream = null; video.srcObject = null;
  scanner.torch = false; $('scanner-torch').hidden = true;
}
async function startCamera() {
  const video = $('scanner-video');
  show($('scanner-camera-error'), '');
  try { scanner.audio ||= new (window.AudioContext || window.webkitAudioContext)(); } catch { /* sem áudio */ }
  try {
    const reader = new window.ZXingBrowser.BrowserQRCodeReader();
    scanner.reader = reader;
    const onResult = (result) => { if (result) queueTicket(result.getText()); };
    const constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } };
    scanner.controls = typeof reader.decodeFromConstraints === 'function'
      ? await reader.decodeFromConstraints(constraints, video, onResult)
      : await reader.decodeFromVideoDevice(undefined, video, onResult);
    scanner.stream = video.srcObject;
    setTimeout(() => {
      const track = scanner.stream?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.();
      $('scanner-torch').hidden = !(caps && 'torch' in caps);
    }, 500);
  } catch {
    show($('scanner-camera-error'), 'Não foi possível acessar a câmera. Verifique permissão da câmera e tente novamente.');
  }
}
function openScanner() {
  scanner.session += 1; scanner.pending = null; scanner.processing = false; scanner.active = null;
  $('scanner-form').hidden = true; $('scanner-feedback').hidden = true;
  $('scanner').showModal();
  startCamera();
}
function closeScanner() {
  scanner.session += 1; scanner.pending = null;
  stopCamera();
  if ($('scanner').open) $('scanner').close();
}

// ---------------------------------------------------------------- Navegação e sessão
function selectTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.admin-tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  document.querySelectorAll('.admin-panel').forEach((panel) => { panel.hidden = panel.dataset.panel !== tab; });
  $('admin-export').hidden = tab !== 'inscricoes';
  if (tab === 'participantes') loadParticipantes();
  if (tab === 'visitas') loadVisitas();
  if (tab === 'resultados' && !results.loaded && !results.loading) loadResults();
  subscribeRealtime();
}

function renderAuth() {
  $('admin-boot').hidden = true;
  const signedIn = Boolean(state.session);
  $('admin-login').hidden = signedIn;
  $('admin-app').hidden = !signedIn;
  $('admin-session').hidden = !signedIn;
  if (signedIn) $('admin-user').textContent = state.session.user?.email || '';
}

async function applySession(session) {
  if (session && !isAllowed(session.user)) {
    show($('admin-login-error'), deniedMessage());
    await supabase.auth.signOut();
    session = null;
  }
  const changed = (state.session?.access_token || null) !== (session?.access_token || null);
  const wasSignedIn = Boolean(state.session);
  state.session = session;
  renderAuth();
  if (session && !wasSignedIn) {
    loadRows(); loadParticipantes(); loadVisitas(); loadRegSettings();
    selectTab(state.tab);
  } else if (!session) {
    if (channel) { supabase.removeChannel(channel); channel = null; }
    Object.assign(state, { rows: [], participantes: [], visitas: [] });
    Object.assign(results, { loaded: false, notas: {} });
    $('res-scores').replaceChildren();
  } else if (changed) {
    subscribeRealtime(); // token renovado
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const button = $('admin-login-submit');
  button.disabled = true; button.textContent = 'Entrando...';
  show($('admin-login-error'), '');
  const { data, error } = await supabase.auth.signInWithPassword({ email: $('admin-email').value.trim(), password: $('admin-password').value });
  if (error) show($('admin-login-error'), /invalid login credentials/i.test(error.message || '') ? 'E-mail ou senha incorretos.' : error.message || 'Falha ao entrar.');
  else if (!isAllowed(data.user)) { show($('admin-login-error'), deniedMessage()); await supabase.auth.signOut(); }
  else { $('admin-password').value = ''; await applySession(data.session); }
  button.disabled = false; button.textContent = 'Entrar';
}

function bindEvents() {
  $('admin-login-form').addEventListener('submit', handleLogin);
  $('admin-logout').addEventListener('click', async () => { closeScanner(); await supabase.auth.signOut(); await applySession(null); });
  document.querySelectorAll('.admin-tabs [role="tab"]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));

  $('insc-filters').addEventListener('click', (event) => {
    const b = event.target.closest('button[data-filter]');
    if (b) { state.filter = b.dataset.filter; renderInscricoes(); }
  });
  $('insc-search').addEventListener('input', (event) => { state.search = event.target.value; renderInscricoes(); });
  $('reg-toggle').addEventListener('click', toggleRegistrations);

  const exportButton = $('admin-export-button');
  const exportList = $('admin-export-list');
  const setExport = (open) => { exportList.hidden = !open; exportButton.setAttribute('aria-expanded', String(open)); };
  exportButton.addEventListener('click', (event) => { event.stopPropagation(); setExport(exportList.hidden); });
  exportList.addEventListener('click', (event) => {
    const b = event.target.closest('button[data-pdf]');
    if (b) { setExport(false); downloadPdf(b.dataset.pdf); }
  });
  document.addEventListener('click', (event) => { if (!event.target.closest('#admin-export')) setExport(false); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setExport(false); });

  $('part-search').addEventListener('input', (event) => { state.partSearch = event.target.value; renderParticipantes(); });
  $('part-refresh').addEventListener('click', loadParticipantes);
  $('part-csv').addEventListener('click', exportCsv);
  $('part-bulk').addEventListener('click', bulkConfirmAndRelease);
  $('part-scan').addEventListener('click', openScanner);
  $('vis-refresh').addEventListener('click', loadVisitas);

  $('res-save').addEventListener('click', saveResults);
  $('res-release').addEventListener('click', openReleaseConfirm);
  $('res-confirm-cancel').addEventListener('click', () => $('res-confirm').close());
  $('res-confirm-ok').addEventListener('click', releaseResults);

  $('scanner-close').addEventListener('click', closeScanner);
  $('scanner').addEventListener('cancel', (event) => { event.preventDefault(); closeScanner(); });
  $('scanner-manual').addEventListener('click', () => { const form = $('scanner-form'); form.hidden = !form.hidden; if (!form.hidden) $('scanner-code').focus(); });
  $('scanner-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const code = $('scanner-code').value.trim();
    if (!code) return;
    const tid = code.toUpperCase();
    // Digitado manualmente: permite repetir o mesmo código (limpa o cooldown).
    scanner.recent.delete(tid);
    queueTicket(tid);
    $('scanner-code').value = '';
  });
  $('scanner-torch').addEventListener('click', async () => {
    const track = scanner.stream?.getVideoTracks?.()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !scanner.torch }] }); scanner.torch = !scanner.torch; $('scanner-torch').setAttribute('aria-pressed', String(scanner.torch)); } catch { /* sem lanterna */ }
  });
}

async function init() {
  bindEvents();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase?.createClient) {
    $('admin-boot').hidden = true; $('admin-login').hidden = false;
    show($('admin-login-error'), 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar o painel administrativo.');
    $('admin-login-submit').disabled = true;
    return;
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const { data: { session } } = await supabase.auth.getSession();
  await applySession(session);
  supabase.auth.onAuthStateChange((_event, current) => { applySession(current); });
}

// Os scripts clássicos (supabase, jsPDF, ZXing) usam defer e rodam antes deste módulo.
init();
