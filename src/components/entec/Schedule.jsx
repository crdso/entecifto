import React from "react";
import { motion } from "framer-motion";

// ============================================================
//  CONTEÚDO EDITÁVEL DO CRONOGRAMA
// ============================================================
const DAYS = [
  {
    label: "DIA 1",
    items: [
      { time: "08:00", activity: "Credenciamento e abertura oficial do ENTEC 2026" },
      { time: "08:30", activity: "Coffee Break" },
      { time: "9:00", activity: "Palestra: Inteligência Artificial, tecnologia e sociedade" },
      { time: "└—————", activity: "Sorteios, dinâmicas e atividades interativas entre as palestras" },
    ],
  },
  {
    label: "DIA 2",
    items: [
      { time: "14:00", activity: "Apresentação dos stands e projetos" },
      { time: "16:30", activity: "Premiação dos stands vencedores" },
      { time: "17:00", activity: "Encerramento oficial do ENTEC 2026" },
    ],
  },
];

export default function Schedule() {
  return (
    <section
      id="cronograma"
      className="relative scroll-mt-24 px-5 sm:px-8 py-20 sm:py-28"
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <h2 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-data to-signal/60">
            Cronograma ENTEC 2026
          </h2>
          <p className="mt-4 text-base sm:text-lg text-dim/70">
            Confira a programação oficial do evento.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {DAYS.map((day, di) => (
            <motion.div
              key={day.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: di * 0.15 }}
              className="rounded-3xl border border-signal/20 bg-white/5 backdrop-blur-xl p-6 sm:p-8"
              style={{ boxShadow: "0 20px 60px -25px rgba(58,1,138,0.3)" }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal/15 border border-signal/40 text-lavender font-display font-bold">
                  {di + 1}
                </span>
                <h3 className="font-display font-bold text-2xl sm:text-3xl text-pulse tracking-wide">
                  {day.label}
                </h3>
              </div>

              <ul className="flex flex-col divide-y divide-energy/40">
                {day.items.map((row, ri) => (
                  <motion.li
                    key={ri}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: ri * 0.08 }}
                    className="group flex items-center gap-4 py-4 pl-3 border-l-2 border-transparent hover:border-signal hover:bg-signal/5 rounded-r-lg transition-all duration-300"
                  >
                    <span className="font-mono text-lavender font-semibold text-sm sm:text-base w-16 shrink-0">
                      {row.time}
                    </span>
                    <span className="text-dim/80 text-sm sm:text-base group-hover:text-data transition-colors">
                      {row.activity}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}