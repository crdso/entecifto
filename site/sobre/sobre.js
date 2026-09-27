// Entrada suave dos blocos ao rolar.
const blocks = document.querySelectorAll('.about-reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  blocks.forEach(block => observer.observe(block));
} else {
  blocks.forEach(block => block.classList.add('is-in'));
}

// Menu: mesmo comportamento das páginas internas.
const menuButton = document.getElementById('about-menu-button');
const menu = document.getElementById('about-menu');
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
