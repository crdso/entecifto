import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

// ============================================================
//  DATA ALVO DA CONTAGEM REGRESSIVA — edite aqui.
//  ENTEC 2026: 16 de setembro de 2026, 08:00 (quarta-feira, Brasília UTC-3)
//  Formato: "AAAA-MM-DDTHH:mm:ss-03:00" (offset fixo de Brasília)
// ============================================================
const EVENT_DATE = "2026-09-16T08:00:00-03:00";

const UNITS = [
  { key: "days", label: "Dias" },
  { key: "hours", label: "Horas" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Seg" },
];

function getRemaining(target) {
  const diff = target.getTime() - Date.now();
  const clamped = Math.max(0, diff);
  const totalSec = Math.floor(clamped / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    done: diff <= 0,
  };
}

export default function Countdown() {
  const target = useMemo(() => new Date(EVENT_DATE), []);
  const [time, setTime] = useState(() => getRemaining(target));

  useEffect(() => {
    const id = setInterval(() => setTime(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <section className="relative px-5 sm:px-8 py-14 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7 }}
        className="max-w-4xl mx-auto text-center"
      >
        <span className="inline-block mb-4 px-3 py-1 rounded-full bg-signal/10 border border-signal/30 text-signal text-xs font-medium tracking-[0.2em] uppercase">
          Falta pouco
        </span>
        <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-data to-signal/60">
          O evento começa em
        </h2>

        {time.done ? (
          <p className="mt-10 font-tech text-2xl sm:text-3xl text-signal animate-pulse">
            O ENTEC 2026 está acontecendo agora!
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5">
            {UNITS.map((u, i) => (
              <motion.div
                key={u.key}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="relative rounded-2xl border border-signal/25 bg-white/5 backdrop-blur-md px-3 py-6 sm:py-7 overflow-hidden"
                style={{ boxShadow: "inset 0 0 40px rgba(58,1,138,0.10)" }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/60 to-transparent" />
                <div
                  key={time[u.key]}
                  className="font-tech font-extrabold text-4xl sm:text-5xl md:text-6xl text-data tabular-nums tracking-tight animate-fade-in-up"
                >
                  {String(time[u.key]).padStart(2, "0")}
                </div>
                <div className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-signal/70 font-medium">
                  {u.label}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <p className="mt-8 text-sm text-dim/60 font-mono">
          {target.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            timeZone: "America/Sao_Paulo",
          })}{" "}
          · {target.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
        </p>
      </motion.div>
    </section>
  );
}