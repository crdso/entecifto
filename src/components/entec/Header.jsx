import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const IFTO_LOGO = "/entec-logo.png";

const NAV_ITEMS = [
  { label: "Sobre", to: "/sobre" },
  { label: "Camisa", id: "camisa" },
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
          ? "bg-void/70 backdrop-blur-xl border-b border-signal/15"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={IFTO_LOGO}
            alt="IFTO"
            className="h-9 w-9 sm:h-10 sm:w-10 object-contain drop-shadow-[0_0_10px_rgba(36,107,253,0.5)]"
          />
          <span className="font-display font-bold tracking-[0.2em] text-data text-sm sm:text-lg">
            ENTEC&nbsp;2026
          </span>
        </div>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-10">
          {NAV_ITEMS.map((item) => (
            <li key={item.to ?? item.id}>
              {item.to ? (
                <Link
                  to={item.to}
                  className="group relative text-data/80 hover:text-data text-sm font-medium uppercase tracking-[0.15em] transition-colors"
                >
                  {item.label}
                  <span className="absolute left-1/2 -bottom-1.5 h-px w-0 -translate-x-1/2 bg-signal transition-all duration-300 group-hover:w-full" />
                </Link>
              ) : (
                <button
                  onClick={() => go(item.id)}
                  className="group relative text-data/80 hover:text-data text-sm font-medium uppercase tracking-[0.15em] transition-colors"
                >
                  {item.label}
                  <span className="absolute left-1/2 -bottom-1.5 h-px w-0 -translate-x-1/2 bg-signal transition-all duration-300 group-hover:w-full" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden text-data p-2 rounded-lg hover:bg-signal/10 transition"
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
        className="md:hidden overflow-hidden bg-void/90 backdrop-blur-xl border-b border-signal/15"
      >
        <ul className="px-5 py-4 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to ?? item.id}>
              {item.to ? (
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="w-full text-left py-3 text-data/80 hover:text-signal text-sm font-medium uppercase tracking-[0.15em] transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  onClick={() => go(item.id)}
                  className="w-full text-left py-3 text-data/80 hover:text-signal text-sm font-medium uppercase tracking-[0.15em] transition-colors"
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