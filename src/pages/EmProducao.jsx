import UtomicHeroBackground from "@/components/entec/UtomicHeroBackground";
import "./EmProducao.css";

// TEMPORÁRIO — página "Em produção" (fotos + certificados em breve).
// Para reverter: em App.jsx, trocar <EmProducao /> por <Home /> na rota "/"
// e apagar EmProducao.jsx + EmProducao.css (+ UtomicHeroBackground.jsx se
// não for reaproveitado). Nada do site original foi alterado.
export default function EmProducao() {
  return (
    <div className="ep-root">
      <UtomicHeroBackground />
      <main className="ep-content">
        <img
          src="/entec-icon-header.webp"
          alt="ENTEC"
          className="ep-logo"
          draggable={false}
        />
        <h1 className="ep-title">
          <span className="ep-entec">ENTEC</span>
          <span className="ep-year">2026</span>
        </h1>
        <p className="ep-headline">Estamos preparando tudo.</p>
        <p className="ep-text">
          As fotos oficiais do ENTEC 2026 e os certificados dos participantes
          estão sendo organizados para liberação.
        </p>
        <p className="ep-small">
          Aguarde mais um pouco. Em breve, tudo estará disponível por aqui.
        </p>
        <div className="ep-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </main>
    </div>
  );
}
