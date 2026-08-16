import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

const SUBTITLE = "Futuro conectado: como a tecnologia está redesenhando o mundo";
const DESCRIPTION =
  "Conheça a camisa oficial do evento — design, tecnologia e identidade em uma única peça.";

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
  const typed = useTypewriter(SUBTITLE);

  return (
    <section className="relative min-h-[88vh] flex items-center justify-center px-5 pt-24 pb-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
        className="max-w-4xl mx-auto mt-16 sm:mt-24"
      >
        <h1
          className="font-tech font-extrabold leading-[0.9] tracking-[0.03em] text-transparent bg-clip-text bg-gradient-to-r from-signal via-data to-signal bg-[length:200%_auto] animate-shimmer text-6xl sm:text-7xl md:text-8xl"
          style={{ filter: "drop-shadow(0 0 30px rgba(58,1,138,0.45))", animationDuration: "6s" }}
        >
          ENTEC 2026
        </h1>

        <p className="mt-4 text-xs sm:text-sm font-medium tracking-[0.25em] uppercase text-signal/80">
          Encontro de Tecnologia · IFTO
        </p>

        <p className="mt-6 text-lg sm:text-2xl md:text-3xl font-light text-dim min-h-[2.5em]">
          {typed}
          <span className="inline-block w-[3px] h-6 sm:h-8 ml-1 bg-signal animate-pulse align-middle" />
        </p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4, duration: 0.8 }}
          className="mt-7 text-base sm:text-lg text-dim/70 max-w-xl mx-auto leading-relaxed"
        >
          {DESCRIPTION}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.9, duration: 0.7 }}
          className="mt-10 flex justify-center"
        >
          <button
            onClick={() => document.getElementById("camisa")?.scrollIntoView({ behavior: "smooth" })}
            className="px-8 py-3.5 rounded-full border border-signal/50 text-data text-sm font-medium tracking-[0.15em] uppercase hover:bg-signal/10 transition-all duration-300"
          >
            Ver a camisa
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}