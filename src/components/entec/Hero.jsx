import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-5 pt-24 pb-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
        className="max-w-4xl mx-auto mt-10 sm:mt-16"
      >
        {/* Data + local — pill elegante */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-signal/10 border border-signal/20 text-lavender text-xs font-medium tracking-[0.14em] uppercase backdrop-blur-md"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-pulse animate-pulse" />
          {EVENT_INFO.dates} • {EVENT_INFO.location}
        </motion.div>

        <h1
          className="mt-6 font-tech font-extrabold leading-[0.9] tracking-[0.03em] text-transparent bg-clip-text bg-gradient-to-r from-signal via-data to-signal bg-[length:200%_auto] animate-shimmer text-6xl sm:text-7xl md:text-8xl"
          style={{ filter: "drop-shadow(0 0 30px rgba(58,1,138,0.45))", animationDuration: "6s" }}
        >
          ENTEC 2026
        </h1>

        <p className="mt-3 text-xs sm:text-sm font-medium tracking-[0.22em] uppercase text-lavender/80">
          Encontro de Tecnologia · IFTO
        </p>

        <p className="mt-6 text-lg sm:text-2xl md:text-3xl font-light text-data min-h-[2.5em] leading-tight">
          {typed}
          <span className="inline-block w-[3px] h-6 sm:h-8 ml-1 bg-signal animate-pulse align-middle" />
        </p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2, duration: 0.8 }}
          className="mt-4 text-sm sm:text-base text-dim/60 max-w-2xl mx-auto leading-relaxed"
        >
          {EVENT_INFO.supportText}
        </motion.p>

        {/* CTAs — hierarquia visual */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6, duration: 0.7 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
        >
          {/* Principal — destaque */}
          <button
            onClick={() => document.getElementById("camisa")?.scrollIntoView({ behavior: "smooth" })}
            className="w-full sm:w-auto px-9 py-4 rounded-full bg-signal text-data font-semibold text-sm tracking-[0.12em] uppercase shadow-[0_0_30px_rgba(58,1,138,0.45)] animate-pulse-glow hover:scale-[1.03] transition-transform"
          >
            Adquira sua camisa
          </button>

          {/* Secundário */}
          <button
            onClick={() => document.getElementById("cronograma")?.scrollIntoView({ behavior: "smooth" })}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full border border-signal/40 text-data text-sm font-medium tracking-[0.12em] uppercase hover:bg-signal/10 hover:border-signal/60 transition-all"
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
        </motion.div>
      </motion.div>
    </section>
  );
}
