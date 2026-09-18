import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const LOGO = "/ENTEC ICON.png";

// Cabeçalho reutilizável para as páginas internas (logo + voltar ao início).
export default function PageHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-signal/15 bg-void/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center shrink-0 group">
          <img src={LOGO} alt="ENTEC 2026" className="h-12 sm:h-14 md:h-16 w-auto object-contain drop-shadow-[0_0_14px_rgba(255,255,255,0.22)] group-hover:brightness-110 transition-all duration-300" />
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-dim/70 hover:text-lavender transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Início
        </Link>
      </div>
    </header>
  );
}