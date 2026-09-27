import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Mesma máscara, validação e resposta HTTP de entec/src/pages/Inscricao.jsx.
function maskCPF(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidCPF(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(d[10]);
}

function validateCertificado(f) {
  const e = {};
  const cpfDigits = String(f.cpf || '').replace(/\D/g, '');
  if (cpfDigits.length !== 11) e.cpf = 'CPF deve conter 11 dígitos.';
  else if (!isValidCPF(f.cpf)) e.cpf = 'CPF inválido.';
  if (!f.nascimento) e.nascimento = 'Informe sua data de nascimento.';
  return e;
}

const form = document.getElementById('certificate-form');
const cpfInput = document.getElementById('certificate-cpf');
const birthInput = document.getElementById('certificate-birth-date');
const submit = document.getElementById('certificate-submit');
const submitLabel = submit.querySelector('.cert-submit-label');
const status = document.getElementById('certificate-status');

function setFieldError(field, message) {
  const input = field === 'cpf' ? cpfInput : birthInput;
  const error = document.getElementById(field === 'cpf' ? 'certificate-cpf-error' : 'certificate-birth-date-error');
  error.textContent = message || '';
  error.hidden = !message;
  input.setAttribute('aria-invalid', String(Boolean(message)));
}

function showStatus(title, description = '', kind = 'error') {
  status.hidden = false;
  status.dataset.kind = kind;
  status.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = title;
  status.append(heading);
  if (description) {
    const detail = document.createElement('span');
    detail.textContent = description;
    status.append(detail);
  }
}

cpfInput.addEventListener('input', () => {
  cpfInput.value = maskCPF(cpfInput.value);
  setFieldError('cpf', '');
  status.hidden = true;
});
birthInput.addEventListener('input', () => {
  setFieldError('nascimento', '');
  status.hidden = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const certForm = { cpf: cpfInput.value, nascimento: birthInput.value };
  const errs = validateCertificado(certForm);
  setFieldError('cpf', errs.cpf);
  setFieldError('nascimento', errs.nascimento);
  status.hidden = true;
  if (Object.keys(errs).length) {
    showStatus('Verifique os campos', 'CPF e data de nascimento são obrigatórios.');
    (errs.cpf ? cpfInput : birthInput).focus();
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showStatus('Não foi possível gerar o certificado agora. Tente novamente.');
    return;
  }

  submit.disabled = true;
  submit.classList.add('is-loading');
  submitLabel.textContent = 'Buscando certificado...';
  form.setAttribute('aria-busy', 'true');
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/event-certificate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ cpf: certForm.cpf, birthDate: certForm.nascimento }),
    });
    if (res.ok && res.headers.get('content-type')?.includes('application/pdf')) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('content-disposition') || '';
      let filename = 'certificado-entec-2026.pdf';
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match) filename = match[1];
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('Certificado encontrado', 'Seu certificado foi gerado com sucesso. O download do PDF foi iniciado.', 'success');
      return;
    }
    const data = await res.json().catch(() => ({}));
    const msg = data.error || '';
    if (res.status === 404) {
      showStatus('Não encontramos uma participação com esses dados.', 'Verifique CPF e data de nascimento.');
    } else if (res.status === 403 && msg.includes('presença')) {
      showStatus('Não há presença confirmada para esta participação.', 'Sua presença ainda não foi confirmada pela organização.');
    } else if (res.status === 403) {
      showStatus('Seu certificado ainda não foi liberado.', 'Aguarde a liberação pela organização.');
    } else {
      showStatus('Não foi possível gerar o certificado agora. Tente novamente.', msg);
    }
  } catch {
    showStatus('Não foi possível gerar o certificado agora. Tente novamente.');
  } finally {
    submit.disabled = false;
    submit.classList.remove('is-loading');
    submitLabel.textContent = 'Acessar certificado';
    form.removeAttribute('aria-busy');
  }
});

const menuButton = document.getElementById('cert-menu-button');
const menu = document.getElementById('cert-menu');
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
