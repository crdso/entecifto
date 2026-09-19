import React from "react";

const NOISE_URI =
  "data:image/svg+xml;utf8,\
<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>\
<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/>\
<feColorMatrix type='saturate' values='0'/></filter>\
<rect width='100%25' height='100%25' filter='url(%23n)'/></svg>";

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-void pointer-events-none select-none">
      {/* Base solid */}
      <div className="absolute inset-0 bg-void" />

      {/* Primary fabric layer - slow drift */}
      <div
        className="absolute inset-0 animate-fabric-drift will-change-transform"
        style={{
          backgroundImage: "url('/entec-silver-bg.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: "scale(1.06)",
          filter: "brightness(0.95) contrast(1.05) saturate(0.9)",
        }}
      />

      {/* Secondary layer - subtle parallax offset, low opacity, soft-light */}
      <div
        className="absolute inset-0 animate-fabric-drift-2 will-change-transform opacity-[0.32] mix-blend-soft-light"
        style={{
          backgroundImage: "url('/entec-silver-bg.webp')",
          backgroundSize: "cover",
          backgroundPosition: "48% 52%",
          transform: "scale(1.12)",
          filter: "brightness(1.15) contrast(1.08)",
        }}
      />

      {/* Silver light veil - very subtle top-center bloom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 70% at 50% 0%, rgba(226,227,230,0.08) 0%, rgba(185,188,195,0.05) 28%, transparent 62%), radial-gradient(ellipse 60% 50% at 82% 18%, rgba(255,255,255,0.06) 0%, transparent 55%)",
        }}
      />

      {/* Gentle linear depth: slightly darker bottom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,7,8,0.10) 0%, rgba(7,7,8,0.18) 45%, rgba(7,7,8,0.52) 85%, rgba(7,7,8,0.78) 100%)",
        }}
      />

      {/* Grain / noise */}
      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE_URI}")` }}
      />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("${NOISE_URI}")`,
          backgroundSize: "180px 180px",
          mixBlendMode: "overlay",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_125%_92%_at_50%_8%,transparent_42%,rgba(7,7,8,0.48)_88%,rgba(7,7,8,0.82)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-void via-void/60 to-transparent" />

      {/* Subtle top metallic hairline highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-60" />
    </div>
  );
}
