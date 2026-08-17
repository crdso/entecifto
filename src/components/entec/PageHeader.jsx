import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const IFTO_LOGO = "/entec-logo.png";

// Cabeçalho reutilizável para as páginas internas (logo + voltar ao início).
export default function PageHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-signal/15 bg-void/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={IFTO_LOGO} alt="IFTO" className="h-9 w-9 object-contain" />
          <span className="font-display font-bold tracking-[0.12em] text-data">
            ENTEC 2026
          </span>
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-dim/70 hover:text-signal transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Início
        </Link>
      </div>
    </header>
  );
}