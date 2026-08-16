import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import ShirtViewer3D from "@/components/entec/ShirtViewer3D";
import PurchaseModal from "@/components/entec/PurchaseModal";

// ============================================================
//  CONTEÚDO EDITÁVEL DA SEÇÃO DA CAMISA
// ============================================================
const SHIRT = {
  title: "Camisa Oficial",
  description:
    "A camisa oficial do ENTEC 2026 foi desenvolvida especialmente para o evento, unindo conforto, qualidade e um design moderno.",
  material: "Algodão premium 100% (fio penteado)",
  sizes: "PP · P · M · G",
  price: "R$ 60,00",
  // Altere este link para WhatsApp, formulário, Mercado Pago ou outro destino
  buyUrl: "https://wa.me/5500000000000",
};

const SPEC = [
  { label: "Material", value: SHIRT.material },
  { label: "Tamanhos", value: SHIRT.sizes },
  { label: "Valor", value: SHIRT.price },
];

export default function ShirtSection() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <section
      id="camisa"
      className="relative scroll-mt-24 px-5 sm:px-8 py-20 sm:py-28"
    >
      <div className="max-w-7xl mx-auto">
        {/* Mobile / single column order: title -> desc -> price -> button -> model */}
        {/* Desktop: two columns */}
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="order-1 text-center lg:text-left"
          >
            <span className="inline-block mb-4 px-3 py-1 rounded-full bg-signal/10 border border-signal/30 text-signal text-xs font-medium tracking-[0.2em] uppercase">
              Edição Oficial
            </span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl text-data leading-tight">
              {SHIRT.title}
            </h2>
            <p className="mt-5 text-base sm:text-lg text-dim/70 leading-relaxed max-w-xl mx-auto lg:mx-0">
              {SHIRT.description}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:justify-center lg:justify-start gap-3 sm:gap-6">
              {SPEC.map((s) => (
                <div
                  key={s.label}
                  className="flex-1 rounded-2xl border border-signal/20 bg-white/5 backdrop-blur-md px-5 py-4 text-center lg:text-left"
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-signal/70 font-medium">
                    {s.label}
                  </div>
                  <div className="mt-1 text-data font-medium text-sm sm:text-base">
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-center lg:justify-start">
              <button
                onClick={() => setModalOpen(true)}
                className="group relative inline-flex items-center gap-3 px-9 py-4 rounded-full bg-signal text-data font-semibold text-base sm:text-lg shadow-[0_0_30px_rgba(58,1,138,0.4)] animate-pulse-glow transition-transform hover:scale-[1.03]"
              >
                Adquira a sua!
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>

          {/* Right column — 3D viewer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="order-2"
          >
            <div
              className="relative rounded-3xl overflow-hidden border border-signal/25 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-sm"
              style={{ boxShadow: "0 30px 80px -20px rgba(58,1,138,0.25), inset 0 0 60px rgba(58,1,138,0.08)" }}
            >
              {/* Scanning line */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal to-transparent animate-scan-line z-10" />

              {/* Floating 3D model inside the box */}
              <div className="animate-float">
                <ShirtViewer3D />
              </div>

              {/* Hint below model */}
              <div className="absolute bottom-0 inset-x-0 pb-4 text-center pointer-events-none">
                <span className="hidden sm:inline-block rounded-full bg-void/60 backdrop-blur-md px-4 py-1.5 text-xs text-dim/70 border border-signal/15">
                  🖱 Arraste para girar • Role para aproximar
                </span>
                <span className="sm:hidden inline-block rounded-full bg-void/60 backdrop-blur-md px-4 py-1.5 text-xs text-dim/70 border border-signal/15">
                  👆 Deslize para girar • Pinça para aproximar
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
        <PurchaseModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}