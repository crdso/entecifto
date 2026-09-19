import { Link } from "react-router-dom";

export default function PageNotFound() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-16 text-center">
      <div className="max-w-lg w-full">
        <p className="text-[11px] tracking-[0.18em] uppercase font-medium text-lavender/70">Erro 404</p>
        <h1 className="mt-3 font-tech font-extrabold text-6xl sm:text-7xl tracking-[0.04em] text-transparent bg-clip-text bg-gradient-to-r from-[#5F636A] via-white to-[#5F636A] bg-[length:200%_auto] animate-shimmer" style={{ filter: "drop-shadow(0 0 30px rgba(220,223,230,0.35))", animationDuration: "6s" }}>
          404
        </h1>
        <h2 className="mt-6 font-display font-semibold text-2xl sm:text-3xl text-data">Página não encontrada</h2>
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-dim/70 max-w-md mx-auto">
          A página que você tentou acessar não existe ou pode ter sido movida.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-7 py-3 rounded-full bg-data text-void text-sm font-semibold tracking-[0.08em] uppercase hover:bg-white transition-colors shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
