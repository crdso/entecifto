import { ABOUT_TARGET } from './navigation.config.js';

const targets = { about: ABOUT_TARGET };
document.querySelectorAll('[data-target]').forEach(link => {
  if (targets[link.dataset.target]) link.href = targets[link.dataset.target];
});

// Stagger já presente na hero editada.
const title = document.querySelector('.uh-title');
const text = title.textContent.trim();
title.textContent = '';
Array.from(text).forEach((ch, i) => {
  const span = document.createElement('span');
  span.className = 'ch';
  if (i >= 5) span.classList.add('uh-year');
  span.style.setProperty('--d', (0.08 + i * 0.06).toFixed(3) + 's');
  span.textContent = ch;
  title.appendChild(span);
});
const mobileTitle = matchMedia('(max-width: 809.98px)');
const labelTitle = () => title.setAttribute('aria-label', mobileTitle.matches ? 'ENTEC' : 'ENTEC2026');
mobileTitle.addEventListener('change', labelTitle);
labelTitle();

// Reutiliza o bloco Bottom original (antes “or connect with us”). O componente
// editado o monta vazio. Somente conteúdo; nenhum módulo/animação Framer é alterado.
function mountFooter() {
  const bottom = document.querySelector('#galeria .framer-w5qk97');
  if (!bottom || bottom.childElementCount) return;
  const footer = document.createElement('footer');
  footer.className = 'entec-footer';
  const copyright = document.createElement('p');
  copyright.textContent = '© 2026 ENTEC · Instituto Federal do Tocantins';
  copyright.append(document.createElement('br'), document.createTextNode('dev: cardoso'));
  footer.append(copyright);
  bottom.append(footer);
}
const footerObserver = new MutationObserver(mountFooter);
footerObserver.observe(document.getElementById('main'), { childList: true, subtree: true });
mountFooter();

const button = document.getElementById('uh-menu-btn');
const menu = document.getElementById('uh-drop');
function setOpen(open, returnFocus = false) {
  menu.classList.toggle('open', open);
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  if (returnFocus) button.focus();
}
button.addEventListener('click', event => {
  event.stopPropagation();
  setOpen(button.getAttribute('aria-expanded') !== 'true');
});
menu.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  setOpen(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.classList.contains('open')) setOpen(false, true);
});
document.addEventListener('click', event => {
  if (!event.target.closest('.uh-header')) setOpen(false);
});
