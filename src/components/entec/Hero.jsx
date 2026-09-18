import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { EVENT_INFO } from "@/data/schedule";

function useTypewriter(text, speed = 45) {
  const [out, setOut] = useState("");
  useEffect(() => {
    let i = 0;
    let timer;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        i += 1;
        setOut(text.slice(0, i));
        if (i >= text.length) clearInterval(timer);
      }, speed);
    }, 500);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [text, speed]);
  return out;
}

export default function Hero() {
  const typed = useTypewriter(EVENT_INFO.subtitle);
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-5 pt-24 pb-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
        className="max-w-4xl mx-auto mt-10 sm:mt-16"
      >
        <h1
          className="mt-6 font-tech font-extrabold leading-[0.9] tracking-[0.03em] text-transparent bg-clip-text bg-gradient-to-r from-[#5F636A] via-white to-[#5F636A] bg-[length:200%_auto] animate-shimmer text-6xl sm:text-7xl md:text-8xl"
          style={{
            filter: "drop-shadow(0 0 30px rgba(220,223,230,0.35))",
            animationDuration: "6s",
          }}
        >
          ENTEC 2026
        </h1>

        <p className="mt-3 text-xs sm:text-sm font-medium tracking-[0.22em] uppercase text-lavender/90">
          Encontro de Tecnologia · IFTO
        </p>

        <p className="mt-6 text-lg sm:text-2xl md:text-3xl font-light text-data min-h-[2.5em] leading-tight">
          {typed}
          <span className="inline-block w-[3px] h-6 sm:h-8 ml-1 bg-signal/70 animate-pulse align-middle" />
        </p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2, duration: 0.8 }}
          className="mt-4 text-sm sm:text-base text-dim/70 max-w-2xl mx-auto leading-relaxed"
        >
          {EVENT_INFO.supportText}
        </motion.p>

        {/* CTAs — nova hierarquia: inscrição em destaque */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6, duration: 0.7 }}
          className="mt-10 flex flex-col items-center justify-center gap-4"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full">
            {/* Principal — Inscrição */}
            <button
              onClick={() => navigate("/inscricao")}
              className="group relative w-full sm:w-auto px-10 py-4 rounded-full bg-data text-void font-semibold text-sm tracking-[0.14em] uppercase overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.6)_inset] hover:shadow-[0_12px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.8)_inset] hover:scale-[1.02] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              {/* metallic sheen passing slowly */}
              <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                <span className="absolute inset-y-0 -left-1/2 w-[55%] bg-gradient-to-r from-transparent via-white/55 to-transparent -skew-x-12 translate-x-[-120%] group-hover:translate-x-[240%] transition-transform duration-[1400ms] ease-[cubic-bezier(0.4,0,0.2,1)]" />
              </span>
              <span className="relative">Fazer minha inscrição</span>
            </button>

            {/* Secundário */}
            <button
              onClick={() => document.getElementById("cronograma")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full border border-signal/30 bg-white/[0.04] backdrop-blur-md text-data text-sm font-medium tracking-[0.12em] uppercase hover:bg-white/[0.08] hover:border-signal/50 hover:text-white transition-all"
            >
              Ver programação
            </button>

            {/* Discreto */}
            <Link
              to="/sobre"
              className="group inline-flex items-center gap-1.5 text-sm text-dim/70 hover:text-lavender transition-colors py-2"
            >
              Conheça o ENTEC
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>

          <p className="text-xs tracking-[0.18em] uppercase text-dim/55 font-medium">
            ENTEC 2026 · 23 e 24 de setembro
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
