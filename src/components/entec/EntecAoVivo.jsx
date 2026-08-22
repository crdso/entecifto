import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { getEntecStatus, formatTimeRange, minutesUntil } from "@/data/schedule";
import Countdown from "./Countdown";

// Wrapper que decide automaticamente o que mostrar
export default function EntecAoVivo() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const status = useMemo(() => getEntecStatus(now), [now]);

  if (status.phase === "before") {
    return <Countdown />;
  }

  return <LiveSection status={status} now={now} />;
}

function LiveSection({ status, now }) {
  const { phase, current, next, dayActivities, allActivities } = status;

  if (phase === "ended") {
    return (
      <section className="relative px-5 sm:px-8 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-xl px-8 py-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-signal/10 border border-signal/20 text-lavender text-xs tracking-[0.16em] uppercase">
              ENTEC 2026
            </div>
            <h2 className="mt-4 font-display font-bold text-3xl sm:text-4xl text-data">ENTEC 2026 encerrado.</h2>
            <p className="mt-3 text-dim/70">Obrigado por fazer parte!</p>
          </motion.div>
        </div>
      </section>
    );
  }

  if (phase === "between_days") {
    return (
      <section className="relative px-5 sm:px-8 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl px-8 py-10"
          >
            <p className="text-amber-300 font-medium">Programação de hoje encerrada.</p>
            <p className="mt-2 text-2xl font-display font-bold text-data">Nos vemos amanhã!</p>
            {next && (
              <p className="mt-3 text-sm text-dim/60">
                Próximo: {next.activity} — {next.dayLabel} às{" "}
                {next.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
              </p>
            )}
          </motion.div>
          {next && <Timeline activities={allActivities.filter((a) => a.date === next.date)} current={null} now={now} />}
        </div>
      </section>
    );
  }

  // live ou between (intervalo)
  const isLive = phase === "live" && current;
  const timelineActivities = dayActivities || allActivities.filter((a) => (current ? a.date === current.date : a.date === next?.date));

  return (
    <section className="relative px-5 sm:px-8 py-16 sm:py-20">
      <div className="max-w-5xl mx-auto">
        {/* Header AO VIVO */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col items-center text-center mb-8"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs font-bold tracking-[0.18em] uppercase text-red-400">ENTEC AO VIVO</span>
          </div>
          <div className="mt-3 h-px w-24 bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Card atual / intervalo */}
          <div className="lg:col-span-3">
            {isLive ? (
              <motion.div
                key={current.activity}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-red-500/20 bg-gradient-to-b from-red-500/5 via-energy/20 to-void/60 backdrop-blur-xl p-6 sm:p-8 shadow-[0_0_40px_rgba(239,68,68,0.15)]"
              >
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-red-300/80 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  Acontecendo agora
                </div>
                <h3 className="mt-3 font-display font-bold text-xl sm:text-2xl text-data leading-tight">
                  {current.activity}
                </h3>
                <p className="mt-2 font-mono text-sm text-lavender">
                  {formatTimeRange(current.start, current.end)} • {current.dayLabel}
                </p>
                {/* Progresso */}
                <div className="mt-5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-red-500 to-pulse"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, Math.max(0, ((now - current.start) / (current.end - current.start)) * 100))}%`,
                    }}
                    transition={{ duration: 1 }}
                  />
                </div>
              </motion.div>
            ) : (
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl p-6 sm:p-8">
                <div className="text-[11px] uppercase tracking-[0.16em] text-amber-300/80 font-medium">Intervalo</div>
                <p className="mt-2 text-data font-medium">Próxima atividade em breve</p>
              </div>
            )}

            {/* Próximo */}
            {next && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-4 rounded-2xl border border-signal/20 bg-white/[0.03] backdrop-blur-md p-5 flex items-center justify-between"
              >
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-lavender/70 font-medium">Próximo</div>
                  <div className="mt-1 font-medium text-data">{next.activity}</div>
                  <div className="text-xs text-dim/60">
                    {next.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} • {next.dayLabel}
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-signal/10 border border-signal/20 text-lavender text-xs font-medium">
                    Começa em {minutesUntil(next.start, now)} min
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Timeline */}
          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-signal/15 bg-white/[0.02] backdrop-blur-md p-6">
              <h4 className="text-[11px] uppercase tracking-[0.16em] text-lavender/60 font-medium mb-4">
                Programação {current ? `— ${current.dayLabel}` : next ? `— ${next.dayLabel}` : ""}
              </h4>
              <Timeline activities={timelineActivities} current={current} now={now} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Timeline({ activities, current, now }) {
  if (!activities || activities.length === 0) return null;
  return (
    <ul className="relative flex flex-col gap-0">
      {/* linha vertical */}
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-signal/30 via-signal/10 to-transparent" />
      {activities.map((a) => {
        const isPast = now >= a.end;
        const isCurrent = current && a.start.getTime() === current.start.getTime();
        const isFuture = now < a.start;
        return (
          <li key={`${a.date}-${a.start.toISOString()}`} className="relative flex gap-3 py-2.5">
            <span
              className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                isPast
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : isCurrent
                    ? "bg-red-500 border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse"
                    : "bg-void border-signal/30 text-dim/40"
              }`}
            >
              {isPast ? "✓" : isCurrent ? "●" : "○"}
            </span>
            <div className="min-w-0 flex-1 -mt-0.5">
              <div
                className={`text-sm leading-tight truncate ${
                  isCurrent ? "text-data font-semibold" : isPast ? "text-dim/50 line-through" : "text-dim/70"
                }`}
                title={a.activity}
              >
                {a.activity}
                {isCurrent && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white font-bold">AGORA</span>}
              </div>
              <div className="text-xs font-mono text-dim/40">
                {a.start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
