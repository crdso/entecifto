import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const LOGO = "/entec.png";

const NAV_ITEMS = [
  { label: "Sobre", to: "/sobre" },
  { label: "Inscrição", to: "/inscricao" },
  { label: "Cronograma", id: "cronograma" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id) => {
    setOpen(false);
    if (document.getElementById(id)) {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(`/#${id}`);
    }
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[rgba(23,23,25,0.72)] backdrop-blur-xl border-b border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center shrink-0 group">
          <img
            src={LOGO}
            alt="ENTEC 2026"
            className="h-8 sm:h-9 md:h-11 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.18)] group-hover:drop-shadow-[0_0_14px_rgba(255,255,255,0.28)] group-hover:brightness-[1.08] transition-all duration-300"
          />
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-10">
          {NAV_ITEMS.map((item) => (
            <li key={item.to ?? item.id}>
              {item.to ? (
                <Link
                  to={item.to}
                  className="group relative text-data/80 hover:text-white text-sm font-medium uppercase tracking-[0.15em] transition-colors"
                >
                  {item.label}
                  <span className="absolute left-1/2 -bottom-1.5 h-px w-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent transition-all duration-300 group-hover:w-full opacity-70" />
                </Link>
              ) : (
                <button
                  onClick={() => go(item.id)}
                  className="group relative text-data/80 hover:text-white text-sm font-medium uppercase tracking-[0.15em] transition-colors"
                >
                  {item.label}
                  <span className="absolute left-1/2 -bottom-1.5 h-px w-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent transition-all duration-300 group-hover:w-full opacity-70" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden text-data p-2 rounded-lg hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition"
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <motion.div
        initial={false}
        animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="md:hidden overflow-hidden bg-[rgba(23,23,25,0.92)] backdrop-blur-xl border-b border-white/[0.07]"
      >
        <ul className="px-5 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to ?? item.id}>
              {item.to ? (
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="w-full text-left py-3 text-data/80 hover:text-white text-sm font-medium uppercase tracking-[0.15em] transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  onClick={() => go(item.id)}
                  className="w-full text-left py-3 text-data/80 hover:text-white text-sm font-medium uppercase tracking-[0.15em] transition-colors"
                >
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.header>
  );
}
