import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

const NAV = [
  { label: "Início", to: "/" },
  { label: "A Camisa", to: "/#camisa" },
  { label: "Programação", to: "/#cronograma" },
];

const EVENT = [
  { label: "Sobre o ENTEC", to: "/sobre" },
];

export default function Footer() {
  const linkClass = "text-sm text-dim/70 hover:text-data transition-colors";

  return (
    <footer className="relative pt-16 pb-8 overflow-hidden border-t border-signal/15">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/40 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="relative max-w-5xl mx-auto px-6"
      >
        <div className="grid gap-10 sm:grid-cols-2 text-center">
          <div>
            <h4 className="text-[11px] uppercase tracking-[0.18em] text-lavender/90 font-medium mb-4">
              Navegação
            </h4>
            <ul className="space-y-2.5">
              {NAV.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className={linkClass}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] uppercase tracking-[0.18em] text-lavender/90 font-medium mb-4">
              O Evento
            </h4>
            <ul className="space-y-2.5">
              {EVENT.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className={linkClass}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-signal/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-dim/40 text-xs text-center sm:text-left">
            © 2026 ENTEC · Instituto Federal do Tocantins / dev: cardoso
          </p>
          <Link to="/privacidade" className="text-xs text-dim/50 hover:text-lavender transition-colors underline-offset-4 hover:underline">
            Política de Privacidade
          </Link>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="group inline-flex items-center gap-2 text-xs text-dim/60 hover:text-lavender transition-colors"
          >
            Voltar ao topo
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-signal/20 group-hover:border-signal/60 transition-colors">
              <ArrowUp className="h-3.5 w-3.5" />
            </span>
          </a>
        </div>
      </motion.div>
    </footer>
  );
}