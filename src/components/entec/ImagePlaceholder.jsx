import React from "react";

// Espaço reservado para imagem. Substitua o conteúdo por:
//   <img src="https://..." alt="..." className="w-full h-full object-cover" />
// dentro da div abaixo.
export default function ImagePlaceholder({ label = "Imagem", className = "" }) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl border border-dashed border-signal/25 bg-gradient-to-b from-energy/20 to-void/60 ${className}`}
    >
      <span className="text-[11px] uppercase tracking-[0.2em] text-signal/40 font-medium">
        {label}
      </span>
    </div>
  );
}