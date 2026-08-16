import React, { useMemo } from "react";

// Nós flutuantes discretos (estilo "circuito/constelação"). Só transform +
// opacity (GPU), posições e tempos sorteados uma única vez por sessão.
function useParticles(count) {
  return useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const size = Math.random() < 0.8 ? 1 : 2;
      const hue = i % 3;
      return {
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size,
        dx: `${(Math.random() - 0.5) * 90}px`,
        dy: `${(Math.random() - 0.5) * 90}px`,
        duration: `${8 + Math.random() * 10}s`,
        delay: `-${Math.random() * 16}s`,
        color: hue === 0 ? "bg-pulse" : hue === 1 ? "bg-signal" : "bg-data",
        glow: hue === 0 ? "rgba(36,107,253,0.8)" : hue === 1 ? "rgba(147,51,234,0.8)" : "rgba(255,255,255,0.6)",
      };
    });
  }, [count]);
}

// Ruído fino em SVG (feTurbulence) como data-uri — textura de grão estática,
// leve, sem imagens externas. Suaviza os gradientes e tira o efeito "chapado".
const NOISE_URI =
  "data:image/svg+xml;utf8,\
<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>\
<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>\
<feColorMatrix type='saturate' values='0'/></filter>\
<rect width='100%25' height='100%25' filter='url(%23n)'/></svg>";

export default function AnimatedBackground() {
  const particles = useParticles(24);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-void pointer-events-none">
      {/* Base: leve gradiente vertical para dar profundidade ao preto puro */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#050816_0%,#0a0620_45%,#0d0322_75%,#050816_100%)]" />

      {/* Mesh gradient: blobs violeta + azul (duotone), tamanhos e derivas variados */}
      <div className="absolute -top-1/4 -left-1/4 h-[65vh] w-[65vh] rounded-full bg-[radial-gradient(circle,rgba(58,1,138,0.55)_0%,rgba(58,1,138,0)_70%)] blur-[90px] animate-aurora-1" />
      <div className="absolute top-1/3 -right-1/4 h-[60vh] w-[60vh] rounded-full bg-[radial-gradient(circle,rgba(36,107,253,0.35)_0%,rgba(36,107,253,0)_70%)] blur-[100px] animate-aurora-2" />
      <div className="absolute -bottom-1/4 left-1/4 h-[55vh] w-[55vh] rounded-full bg-[radial-gradient(circle,rgba(36,16,74,0.7)_0%,rgba(36,16,74,0)_70%)] blur-[100px] animate-aurora-3" />
      <div className="absolute top-0 right-1/3 h-[40vh] w-[40vh] rounded-full bg-[radial-gradient(circle,rgba(36,107,253,0.22)_0%,rgba(36,107,253,0)_70%)] blur-[110px] animate-aurora-4" />

      {/* Sweep cônico giratório: brilho holográfico muito sutil, dá movimento macro sem chamar atenção */}
      <div
        className="absolute -inset-[20%] opacity-[0.5] animate-spin-slow"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(58,1,138,0.10) 70deg, transparent 160deg, rgba(36,107,253,0.08) 250deg, transparent 340deg)",
        }}
      />

      {/* Grid técnico, concentrado no topo e esmaecendo — evita competir com o conteúdo abaixo */}
      <div
        className="absolute inset-0 opacity-[0.05] animate-drift-grid"
        style={{
          backgroundImage:
            "linear-gradient(rgba(216,220,229,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(216,220,229,0.7) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black, transparent 75%)",
        }}
      />

      {/* Nós flutuantes — leve sensação de rede/constelação tech */}
      {particles.map((p) => (
        <span
          key={p.id}
          className={`absolute rounded-full ${p.color} animate-particle-drift`}
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            boxShadow: `0 0 6px 1px ${p.glow}`,
            "--dx": p.dx,
            "--dy": p.dy,
            animationDuration: p.duration,
            animationDelay: p.delay,
          }}
        />
      ))}

      {/* Grão / ruído — quebra o gradiente e dá acabamento premium (mix-blend-mode) */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE_URI}")` }}
      />

      {/* Vinheta: foca o centro e reforça o contraste nas bordas/rodapé */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_10%,transparent_35%,rgba(5,8,22,0.55)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void to-transparent" />
    </div>
  );
}
