// Entrada suave das seções e menu (mesmo comportamento de /sobre).
const blocks = document.querySelectorAll('.privacy-reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  blocks.forEach(block => observer.observe(block));
} else {
  blocks.forEach(block => block.classList.add('is-in'));
}

const menuButton = document.getElementById('page-menu-button');
const menu = document.getElementById('page-menu');
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
