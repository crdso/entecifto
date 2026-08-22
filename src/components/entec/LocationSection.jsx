import React from "react";
import { motion } from "framer-motion";
import { MapPin, Calendar, Navigation } from "lucide-react";
import { EVENT_INFO } from "@/data/schedule";

export default function LocationSection() {
  return (
    <section id="local" className="relative scroll-mt-24 px-5 sm:px-8 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-signal/10 border border-signal/20 text-lavender text-[11px] font-medium tracking-[0.16em] uppercase">
            <MapPin className="h-3.5 w-3.5" />
            Onde acontece
          </div>
          <h2 className="mt-4 font-display font-bold text-4xl sm:text-5xl text-data">ONDE ACONTECE</h2>
          <p className="mt-3 text-dim/60 text-sm sm:text-base max-w-2xl mx-auto">
            {EVENT_INFO.locationFull}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="max-w-3xl mx-auto rounded-3xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-xl p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start sm:items-center">
            <div className="flex-1">
              <h3 className="font-display font-bold text-xl text-data">{EVENT_INFO.location}</h3>
              <p className="mt-1 text-sm text-dim/60">{EVENT_INFO.locationFull}</p>

              <div className="mt-6 space-y-4">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal/15 border border-signal/20 text-lavender">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-data">{EVENT_INFO.dates}</div>
                    <div className="text-xs text-dim/60">Dois dias de programação</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal/15 border border-signal/20 text-lavender">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-data">{EVENT_INFO.city}</div>
                    <div className="text-xs text-dim/60 leading-relaxed">{EVENT_INFO.address}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-3 sm:min-w-[180px]">
              <a
                href={EVENT_INFO.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-signal text-data font-semibold text-sm shadow-[0_0_24px_rgba(58,1,138,0.35)] hover:scale-[1.02] transition-transform"
              >
                <Navigation className="h-4 w-4" />
                Abrir no Maps
              </a>
              <p className="text-[11px] text-dim/40 leading-relaxed text-center sm:text-right">
                Estacionamento e acessibilidade no campus.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
