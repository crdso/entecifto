import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Loader2, RotateCcw, AlertTriangle, Clock } from "lucide-react";
import Header from "@/components/entec/Header";
import Footer from "@/components/entec/Footer";
import { supabase } from "@/lib/supabase";
import {
  computeRanking,
  formatScore,
  getAdminResults,
  getPublicResults,
  previewSeenKey,
  seenKeyFor,
} from "@/lib/standResults";

// Sequência da revelação (3º → 2º → 1º): plataforma sobe do bottom,
// pausa, nome aparece acima, plataforma viaja para a lateral.
// Durações em ms por etapa (~21s no total).
const REVEAL_STEPS = [
  "prep",
  "p3-rise",
  "p3-hold",
  "p3-name",
  "p3-exit",
  "p2-rise",
  "p2-hold",
  "p2-name",
  "p2-exit",
  "anticipation",
  "spotlight",
  "p1-rise",
  "p1-hold",
  "p1-name",
];
const REVEAL_DURATIONS = [1000, 800, 1500, 2000, 800, 800, 1500, 2000, 800, 1200, 1400, 900, 2200, 3000];

const EASE = [0.22, 1, 0.36, 1];

function Eyebrow({ children }) {
  return (
    <p className="text-[11px] sm:text-xs font-medium tracking-[0.3em] uppercase text-lavender/80">
      {children}
    </p>
  );
}

function ChromeTitle({ children, className, tone = "silver" }) {
  const vivid = tone === "cyan";
  return (
    <h1
      className={`font-tech font-extrabold tracking-[0.04em] text-transparent bg-clip-text bg-[length:200%_auto] animate-shimmer ${
        vivid
          ? "bg-gradient-to-r from-[#22D3EE] via-[#F7F7F8] to-[#67E8F9]"
          : "bg-gradient-to-r from-[#5F636A] via-white to-[#5F636A]"
      } ${className || ""}`}
      style={
        vivid
          ? { filter: "drop-shadow(0 0 22px rgba(34,211,238,0.40))", animationDuration: "5s" }
          : { filter: "drop-shadow(0 0 26px rgba(220,223,230,0.28))", animationDuration: "6s" }
      }
    >
      {children}
    </h1>
  );
}

function Hairline() {
  return (
    <div className="mx-auto mt-6 h-px w-24 bg-gradient-to-r from-transparent via-signal to-transparent" />
  );
}

// Monta o pódio a partir da resposta pública (nomes + notas).
function podiumFromPublic(res) {
  return {
    first: res.first,
    second: res.second,
    third: res.third,
    firstScore: res.first_score,
    secondScore: res.second_score,
    thirdScore: res.third_score,
  };
}

// Selo da prévia do admin — deixa claro que nada foi publicado.
function PreviewBanner() {
  return (
    <div className="mx-auto mb-8 max-w-xl rounded-xl border border-amber-300/30 bg-amber-300/[0.07] px-4 py-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">
        Prévia não publicada
      </p>
      <p className="mt-1 text-xs leading-relaxed text-dim/70">
        Visível somente para você (admin logado). Os visitantes continuam vendo a tela de suspense.
      </p>
    </div>
  );
}

// ---------------- Tela: carregando ----------------
function LoadingState() {
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-lavender" />
      <p className="text-sm tracking-[0.2em] uppercase text-dim/70 animate-silver-glow">
        Consultando o resultado oficial…
      </p>
    </div>
  );
}

// ---------------- Tela: erro ----------------
function ErrorState({ onRetry }) {
  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center text-center px-2">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-signal/25 bg-white/[0.04]">
        <AlertTriangle className="h-5 w-5 text-signal" />
      </span>
      <h2 className="mt-5 font-tech text-xl sm:text-2xl font-bold tracking-[0.06em] text-data">
        NÃO FOI POSSÍVEL CARREGAR
      </h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-dim/70">
        Houve uma falha ao consultar o resultado oficial. Verifique sua conexão e tente novamente.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-data px-7 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-void transition-all hover:scale-[1.02]"
        >
          <RotateCcw className="h-4 w-4" />
          Tentar novamente
        </button>
        <Link to="/" className="text-sm text-dim/70 hover:text-lavender transition-colors">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

// ---------------- Tela: suspense (pré-liberação) ----------------
function SuspenseState() {
  const ghosts = [
    { pos: "2º", cls: "sm:order-1 sm:translate-y-6" },
    { pos: "1º", cls: "sm:order-2 border-signal/40" },
    { pos: "3º", cls: "sm:order-3 sm:translate-y-10" },
  ];
  return (
    <div className="text-center">
      <Eyebrow>ENTEC 2026 · Resultado oficial dos stands</Eyebrow>
      <ChromeTitle className="mt-3 text-4xl sm:text-6xl">RESULTADO DOS STANDS</ChromeTitle>
      <p className="mt-4 text-base sm:text-lg font-light text-data/90">
        O pódio está quase pronto.
      </p>
      <Hairline />

      {/* Silhuetas do pódio — números parcialmente escondidos, sem nomes */}
      <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 items-end gap-2 sm:gap-4" aria-hidden="true">
        {ghosts.map((g) => (
          <div
            key={g.pos}
            className={`relative overflow-hidden rounded-2xl border border-signal/20 bg-gradient-to-b from-energy/50 to-void/70 px-2 py-6 sm:py-8 backdrop-blur-md ${g.cls}`}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] via-transparent to-transparent" />
            <div className="font-tech text-4xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white/50 to-white/5 blur-[3px] select-none animate-silver-glow">
              {g.pos.replace("º", "")}
            </div>
            <div className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.24em] text-dim/60">
              {g.pos} lugar
            </div>
            <div className="mx-auto mt-3 h-1.5 w-3/4 rounded-full bg-white/10 blur-[2px]" />
          </div>
        ))}
      </div>

      {/* Previsão */}
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-signal/20 bg-white/[0.03] px-6 py-6 backdrop-blur-md">
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-lavender/80">
          <Clock className="h-3.5 w-3.5" />
          Previsão de divulgação
        </p>
        <p className="mt-2 font-tech text-4xl sm:text-5xl font-extrabold tracking-[0.06em] text-data">
          17:00
        </p>
        <p className="mt-3 text-xs sm:text-sm leading-relaxed text-dim/60">
          A divulgação poderá ser estendida até a manhã seguinte.
        </p>
      </div>
    </div>
  );
}

// ---------------- Pódio final ----------------
function FinalPodium({ podium, onReplay }) {
  const cols = [
    { place: "second", digit: "2", name: podium.second, score: podium.secondScore, tone: "silver", medal: "silver", champ: false },
    { place: "first", digit: "1", name: podium.first, score: podium.firstScore, tone: "gold", medal: "gold", champ: true },
    { place: "third", digit: "3", name: podium.third, score: podium.thirdScore, tone: "bronze", medal: "bronze", champ: false },
  ];
  const platTone = {
    gold: "border-cyan-200/60 bg-gradient-to-b from-[#2BC3D6] via-[#0E7490] to-[#083038] shadow-[0_0_50px_rgba(34,211,238,0.30)]",
    silver: "border-cyan-300/40 bg-gradient-to-b from-[#0F5A6B] via-[#0C3540] to-[#08141A]",
    bronze: "border-cyan-400/25 bg-gradient-to-b from-[#12313A] via-[#0C242B] to-[#071318]",
  };
  const platH = {
    first: "h-[300px] sm:h-[420px]",
    second: "h-[220px] sm:h-[310px]",
    third: "h-[180px] sm:h-[250px]",
  };
  return (
    <div className="text-center">
      <Eyebrow>ENTEC 2026 · Resultado oficial</Eyebrow>
      <ChromeTitle tone="cyan" className="mt-3 text-4xl sm:text-6xl">PÓDIO — MELHORES STANDS</ChromeTitle>
      <Hairline />

      <div className="mx-auto mt-10 grid w-[96vw] max-w-[720px] grid-cols-[27%_34%_27%] items-end justify-center gap-x-1 sm:gap-x-2">
        {cols.map((c, i) => (
          <motion.div
            key={c.place}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: i * 0.12, ease: EASE }}
            className="flex min-w-0 flex-col items-center justify-end"
          >
            <img
              src={MASCOTS[c.place]}
              alt={`Mascote do ${c.digit}º lugar`}
              draggable={false}
              className="select-none object-contain"
              style={{ width: c.champ ? "clamp(125px, 30vw, 200px)" : "clamp(90px, 23vw, 148px)" }}
            />
            <div className={`relative mt-2 flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-t-md border-x border-t px-1 py-5 sm:py-6 ${platTone[c.tone]} ${platH[c.place]}`}>
              <div
                className={`absolute inset-x-0 top-0 h-[3px] ${
                  c.champ
                    ? "bg-gradient-to-r from-transparent via-white/80 to-transparent"
                    : "bg-gradient-to-r from-transparent via-cyan-100/40 to-transparent"
                }`}
              />
              <div style={{ width: c.champ ? "clamp(58px, 15vw, 78px)" : "clamp(46px, 12vw, 66px)" }} className="aspect-square shrink-0">
                <Medal digit={c.digit} tone={c.medal} size="100%" />
              </div>
              <p
                className={`w-full break-words font-extrabold leading-tight text-data line-clamp-2 ${
                  c.champ ? "text-lg sm:text-3xl" : "text-sm sm:text-lg"
                }`}
              >
                {c.name}
              </p>
              <p className={`font-semibold text-white/75 ${c.champ ? "text-base sm:text-xl" : "text-xs sm:text-base"}`}>
                {formatScore(c.score)}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mx-auto mt-0 h-px w-[96vw] max-w-[720px] bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent" />

      <button
        onClick={onReplay}
        className="mt-10 inline-flex items-center gap-2 rounded-full border border-signal/25 bg-white/[0.04] px-6 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-dim/70 transition-all hover:border-signal/50 hover:text-data"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Rever divulgação
      </button>
    </div>
  );
}

// ---------------- Revelação: teatro foreground → background ----------------
// Fase de cada pedestal conforme a etapa: "hidden", "pedestal" (só a
// estrutura, sem número), "base" (estrutura + número, sem nome) ou "named".
function revealPhase(place, step) {
  if (place === "third") {
    if (step < 1) return "hidden";
    if (step < 3) return "base";
    return "named";
  }
  if (place === "second") {
    if (step < 5) return "hidden";
    if (step < 7) return "base";
    return "named";
  }
  if (step < 11) return "hidden";
  if (step < 12) return "pedestal";
  if (step < 13) return "base";
  return "named";
}

// Posição de cada pedestal: "fg" (centro, protagonista), "left" ou "right".
function revealPose(place, step) {
  if (place === "third") return step < 4 ? "fg" : "right";
  if (place === "second") return step < 8 ? "fg" : "left";
  return "fg";
}

// Viewport real, para dimensionar palco e plataformas em px.
function useViewport() {
  const [vp, setVp] = useState({ w: 390, h: 700 });
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return vp;
}

// Holofote de palco: cone único que ENTRA UMA VEZ e permanece.
// Origem no topo central, abrindo em direção ao pedestal do campeão.
function Spotlight() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.4, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0"
    >
      <div
        className="absolute left-1/2 top-[-8%] h-[82%] w-[70vw] max-w-[520px] -translate-x-1/2"
        style={{
          clipPath: "polygon(41% 0, 59% 0, 100% 100%, 0% 100%)",
          background:
            "linear-gradient(to bottom, rgba(180,245,255,0.30), rgba(103,232,249,0.10) 55%, transparent 90%)",
          filter: "blur(10px)",
        }}
      />
      <div
        className="absolute left-1/2 top-[-8%] h-[82%] w-[30vw] max-w-[240px] -translate-x-1/2"
        style={{
          clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0% 100%)",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.30), transparent 75%)",
          filter: "blur(8px)",
        }}
      />
      <div
        className="absolute bottom-[3%] left-1/2 h-[80px] w-[64vw] max-w-[480px] -translate-x-1/2 rounded-[100%]"
        style={{
          background: "radial-gradient(ellipse, rgba(103,232,249,0.24), transparent 70%)",
          filter: "blur(6px)",
        }}
      />
    </motion.div>
  );
}

// Mascotes oficiais do pódio (arquivos reais em public/).
const MASCOTS = {
  first: "/1%20lugar.png",
  second: "/2%20lugar.png",
  third: "/3%20lugar.png",
};

// Medalha poligonal facetada (SVG): mesma geometria, metal por colocação.
function Medal({ digit, tone, size }) {
  const metals = {
    gold: { stops: ["#FFD54A", "#F5B800", "#D99A00"], num: "#FFF8DC", id: "medal-gold" },
    silver: { stops: ["#E5E7EB", "#AEB4BC", "#747B85"], num: "#FFFFFF", id: "medal-silver" },
    bronze: { stops: ["#F97316", "#C65313", "#87320F"], num: "#FFEDD5", id: "medal-bronze" },
  };
  const m = metals[tone] || metals.silver;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={m.id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.stops[0]} />
          <stop offset="0.55" stopColor={m.stops[1]} />
          <stop offset="1" stopColor={m.stops[2]} />
        </linearGradient>
      </defs>
      <polygon
        points="50,3 91,27 91,73 50,97 9,73 9,27"
        fill={`url(#${m.id})`}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polygon points="50,3 91,27 50,51 9,27" fill="rgba(255,255,255,0.20)" />
      <line x1="50" y1="51" x2="50" y2="97" stroke="rgba(0,0,0,0.20)" strokeWidth="2" />
      <text x="50" y="68" textAnchor="middle" fontSize="42" fontWeight="900" fill={m.num} fontFamily="Orbitron, sans-serif">
        {digit}
      </text>
    </svg>
  );
}

// Unidade do pódio estilo Kahoot: mascote + medalha + nome + média viajam
// juntos com a plataforma. O MESMO elemento nasce no centro e vai para a
// lateral. Fases: hidden | platform | shown | named.
function PodiumPlatform({ place, name, score, phase, big, x, w, h, mascW, medalS, dimmed, tone, champion, z }) {
  const showMedal = phase !== "hidden";
  const showDetails = phase === "named";
  const medalTone = place === "first" ? "gold" : place === "second" ? "silver" : "bronze";
  const posLabel = place === "first" ? "1º" : place === "second" ? "2º" : "3º";
  const digit = posLabel.replace("º", "");
  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 sm:bottom-8"
      style={{ zIndex: z }}
    >
      <motion.div
        initial={{ opacity: 0, y: 140 }}
        animate={{
          opacity: phase === "hidden" ? 0 : dimmed ? 0.85 : 1,
          filter: dimmed ? "brightness(0.65)" : "brightness(1)",
          x,
          y: phase === "hidden" ? 140 : 0,
          width: w,
        }}
        transition={{
          x: { duration: 0.8, ease: EASE },
          y: { duration: 0.8, ease: EASE },
          width: { duration: 0.8, ease: EASE },
          opacity: { duration: 0.5 },
          filter: { duration: 0.8 },
        }}
        style={{ width: w }}
        className="flex shrink-0 flex-col items-center justify-end"
      >
        {/* mascote: só o personagem, sem caixa/fundo/borda */}
        <AnimatePresence>
          {showDetails && (
            <motion.img
              src={MASCOTS[place]}
              alt={`Mascote do ${posLabel} lugar`}
              draggable={false}
              initial={{ opacity: 0, y: champion ? 25 : 20, scale: champion ? 0.82 : 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={
                champion
                  ? { type: "spring", stiffness: 170, damping: 16 }
                  : { duration: 0.5, ease: EASE }
              }
              style={{ width: mascW }}
              className="max-w-none select-none object-contain transition-[width] duration-700 ease-out"
            />
          )}
        </AnimatePresence>
        {/* plataforma sólida bottom-anchored, com medalha + nome + nota dentro */}
        <motion.div
          initial={false}
          animate={{ height: h }}
          transition={{ height: { duration: 0.8, ease: EASE } }}
          style={{ height: h }}
          className={`relative mt-2 flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-t-md border-x border-t px-1 py-4 ${
            tone === "gold"
              ? "border-cyan-200/60 bg-gradient-to-b from-[#2BC3D6] via-[#0E7490] to-[#083038] shadow-[0_0_70px_rgba(34,211,238,0.35)]"
              : tone === "bronze"
                ? "border-cyan-400/25 bg-gradient-to-b from-[#12313A] via-[#0C242B] to-[#071318]"
                : "border-cyan-300/40 bg-gradient-to-b from-[#0F5A6B] via-[#0C3540] to-[#08141A]"
          }`}
        >
          <div
            className={`absolute inset-x-0 top-0 h-[3px] ${
              tone === "gold"
                ? "bg-gradient-to-r from-transparent via-white/80 to-transparent"
                : tone === "bronze"
                  ? "bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent"
                  : "bg-gradient-to-r from-transparent via-cyan-100/50 to-transparent"
            }`}
          />
          {/* medalha poligonal dentro do bloco */}
          <motion.div
            initial={false}
            animate={{ opacity: showMedal ? 1 : 0, scale: showMedal ? 1 : 0.6 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <Medal digit={digit} tone={medalTone} size={medalS} />
          </motion.div>
          {/* nome + média dentro do bloco */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
                className="w-full max-w-[220px] text-center"
              >
                <p
                  className={`font-extrabold leading-tight break-words line-clamp-2 ${
                    champion
                      ? "text-transparent bg-clip-text bg-gradient-to-r from-white via-[#A5F3FC] to-white bg-[length:200%_auto] animate-shimmer"
                      : "text-data"
                  }`}
                  style={
                    big
                      ? champion
                        ? { fontSize: "clamp(1.5rem, 6vw, 2.5rem)", animationDuration: "4s", filter: "drop-shadow(0 0 18px rgba(165,243,252,0.4))" }
                        : { fontSize: "clamp(1.2rem, 5vw, 2rem)" }
                      : champion
                        ? { fontSize: 15 }
                        : { fontSize: 13 }
                  }
                >
                  {name}
                </p>
                <p
                  className="mt-1 font-bold text-white/80"
                  style={big ? { fontSize: 16 } : { fontSize: 12 }}
                >
                  {formatScore(score)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

const PARTICLES = [
  { left: "12%", top: "30%", delay: 0 },
  { left: "22%", top: "62%", delay: 0.4 },
  { left: "34%", top: "24%", delay: 0.8 },
  { left: "50%", top: "70%", delay: 0.2 },
  { left: "64%", top: "28%", delay: 0.6 },
  { left: "76%", top: "58%", delay: 1 },
  { left: "86%", top: "36%", delay: 0.3 },
  { left: "42%", top: "44%", delay: 0.9 },
];

function RevealTheater({ step, podium }) {
  const vp = useViewport();
  const key = REVEAL_STEPS[step];

  // Pódio compacto calculado DENTRO do container: 27% / 34% / 27%.
  const cw = Math.min(vp.w * 0.94, 600);
  const gap = Math.max(4, Math.min(12, cw * 0.02));
  const w1 = cw * 0.34;
  const wSide = cw * 0.27;
  const xSide = w1 / 2 + gap + wSide / 2;
  const isMobile = vp.w < 640;
  const hFg = isMobile ? 300 : 360;
  const heights = {
    first: isMobile ? 300 : 420,
    second: isMobile ? 230 : 320,
    third: isMobile ? 190 : 260,
  };
  const fgW = Math.min(cw * 0.8, 360);
  const mascFg = isMobile ? 128 : 180;
  const medalFg = isMobile ? 72 : 92;
  const mascSide = { first: isMobile ? 100 : 150, second: isMobile ? 82 : 120, third: isMobile ? 76 : 110 };
  const medalSide = { first: isMobile ? 52 : 68, second: isMobile ? 44 : 58, third: isMobile ? 44 : 58 };

  const dim = step >= 9;

  const cards = [
    { place: "third", name: podium.third, score: podium.thirdScore, tone: "bronze", champion: false, side: 1 },
    { place: "second", name: podium.second, score: podium.secondScore, tone: "silver", champion: false, side: -1 },
    { place: "first", name: podium.first, score: podium.firstScore, tone: "gold", champion: true, side: 0 },
  ];

  return (
    <>
      {/* fundo azul-petróleo profundo + halo ciano + vinheta escura */}
      <div className="absolute inset-0 bg-[#05090C]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(6,182,212,0.20),rgba(8,40,50,0.55)_48%,rgba(4,7,10,0)_78%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(2,5,8,0.75)_100%)]" />
      {/* penumbra antes do campeão */}
      <AnimatePresence>
        {step >= 9 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="pointer-events-none absolute inset-0 z-[5] bg-black/55"
          />
        )}
      </AnimatePresence>
      {/* plataformas: o mesmo elemento nasce no centro e viaja para a lateral */}
      <div className="absolute inset-0 z-10">
        {cards.map((c) => {
          const phase = revealPhase(c.place, step);
          const pose = revealPose(c.place, step);
          const isFg = pose === "fg";
          return (
            <PodiumPlatform
              key={c.place}
              place={c.place}
              name={c.name}
              score={c.score}
              phase={phase}
              big={isFg}
              x={isFg ? 0 : c.side * xSide}
              w={isFg ? fgW : (c.place === "first" ? w1 : wSide)}
              h={isFg ? hFg : heights[c.place]}
              mascW={isFg ? mascFg : mascSide[c.place]}
              medalS={isFg ? medalFg : medalSide[c.place]}
              dimmed={!isFg && dim}
              tone={c.tone}
              champion={c.champion}
              z={isFg ? 30 : 10}
            />
          );
        })}
      </div>
      {/* holofote: entra uma vez e permanece */}
      <AnimatePresence>
        {step >= 10 && (
          <div className="absolute inset-0 z-20">
            <Spotlight />
          </div>
        )}
      </AnimatePresence>
      {/* título breve de abertura */}
      {key === "prep" && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="absolute inset-x-0 top-[30%] z-30 text-center"
        >
          <Eyebrow>ENTEC 2026 · Resultado oficial</Eyebrow>
          <p className="mt-2 font-tech text-2xl sm:text-4xl font-extrabold tracking-[0.06em] text-data">
            RESULTADOS
          </p>
        </motion.div>
      )}
      {/* impacto do campeão */}
      {key === "first-name" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.35, 0] }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 z-30 bg-white"
        />
      )}
      {key === "first-name" &&
        PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 0.9, 0], y: -34 }}
            transition={{ duration: 2.2, delay: p.delay, ease: "easeOut" }}
            className={`pointer-events-none absolute z-30 h-1 w-1 rounded-full ${i % 2 === 0 ? "bg-white/90" : "bg-cyan-200/80"}`}
            style={{ left: p.left, top: p.top }}
          />
        ))}
    </>
  );
}

// ---------------- Página ----------------
export default function Resultados() {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);
  const [step, setStep] = useState(0);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const showSuspense = () => {
    setData(null);
    setPhase("suspense");
  };

  // Prévia do admin: se houver sessão de admin NESTE navegador, busca o
  // rascunho (via admin_get, validado no servidor) e mostra o pódio como
  // se estivesse postado — sem publicar nada (results_released intacto).
  const tryPreview = async () => {
    try {
      if (!supabase) return false;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return false;
      const admin = await getAdminResults(token);
      if (admin?.results_released) return false;
      const ranking = computeRanking(admin?.scores || {});
      if (ranking.length < 3) return false;
      const top = ranking.slice(0, 3);
      setData({
        releasedAt: null,
        preview: true,
        podium: {
          first: top[0].group,
          second: top[1].group,
          third: top[2].group,
          firstScore: top[0].score,
          secondScore: top[1].score,
          thirdScore: top[2].score,
        },
      });
      let seen = false;
      try {
        seen = Boolean(window.localStorage.getItem(previewSeenKey()));
      } catch {
        seen = false;
      }
      if (seen || reducedMotion) {
        if (!seen) {
          try {
            window.localStorage.setItem(previewSeenKey(), "1");
          } catch {
            // armazenamento indisponível — segue para a prévia final
          }
        }
        setPhase("final");
      } else {
        setStep(0);
        setPhase("reveal");
      }
      return true;
    } catch {
      return false;
    }
  };

  const load = async () => {
    setPhase("loading");
    try {
      const res = await getPublicResults();
      if (!res || !res.released) {
        const previewed = await tryPreview();
        if (!previewed) showSuspense();
        return;
      }
      const podium = podiumFromPublic(res);
      setData({ releasedAt: res.released_at, podium });
      let seen = false;
      try {
        seen = Boolean(window.localStorage.getItem(seenKeyFor(res.released_at)));
      } catch {
        seen = false;
      }
      if (seen || reducedMotion) {
        if (!seen) {
          try {
            window.localStorage.setItem(seenKeyFor(res.released_at), "1");
          } catch {
            // armazenamento indisponível — segue para o pódio final
          }
        }
        setPhase("final");
      } else {
        setStep(0);
        setPhase("reveal");
      }
    } catch {
      setPhase("error");
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getPublicResults();
        if (!mounted) return;
        if (!res || !res.released) {
          const previewed = await tryPreview();
          if (mounted && !previewed) showSuspense();
          return;
        }
        const podium = podiumFromPublic(res);
        setData({ releasedAt: res.released_at, podium });
        let seen = false;
        try {
          seen = Boolean(window.localStorage.getItem(seenKeyFor(res.released_at)));
        } catch {
          seen = false;
        }
        const prefersReduced =
          typeof window !== "undefined" &&
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (seen || prefersReduced) {
          if (!seen) {
            try {
              window.localStorage.setItem(seenKeyFor(res.released_at), "1");
            } catch {
              // armazenamento indisponível — segue para o pódio final
            }
          }
          setPhase("final");
        } else {
          setStep(0);
          setPhase("reveal");
        }
      } catch {
        if (mounted) setPhase("error");
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Avança a sequência da revelação; ao concluir, marca como visto.
  useEffect(() => {
    if (phase !== "reveal") return;
    if (step >= REVEAL_STEPS.length) {
      const key = data?.preview ? previewSeenKey() : seenKeyFor(data?.releasedAt);
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        // armazenamento indisponível — apenas exibe o pódio final
      }
      setPhase("final");
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), REVEAL_DURATIONS[step]);
    return () => clearTimeout(t);
  }, [phase, step, data]);

  // Trava o scroll do body durante a apresentação fullscreen.
  useEffect(() => {
    if (phase !== "reveal") return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  const skipReveal = () => {
    const key = data?.preview ? previewSeenKey() : seenKeyFor(data?.releasedAt);
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // armazenamento indisponível — apenas exibe o pódio final
    }
    setPhase("final");
  };

  const replay = () => {
    setStep(0);
    setPhase("reveal");
  };

  const stepIndex = Math.min(step, REVEAL_STEPS.length - 1);

  return (
    <div className="relative min-h-screen text-data font-body overflow-x-hidden">
      <Header />
      <main className="relative mx-auto w-full max-w-6xl px-5 sm:px-8 pt-28 sm:pt-32 pb-20">
        {phase === "loading" && <LoadingState />}
        {phase === "error" && <ErrorState onRetry={load} />}
        {phase === "suspense" && <SuspenseState />}
        {phase === "reveal" && data && (
          <div className="fixed inset-0 z-[9999] overflow-hidden bg-void">
            <RevealTheater step={stepIndex} podium={data.podium} />
            {data.preview && (
              <div className="absolute inset-x-0 top-0 z-[70] px-4 pt-4">
                <PreviewBanner />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-5 z-[70] text-center">
              <button
                onClick={skipReveal}
                className="text-xs uppercase tracking-[0.22em] text-data/50 hover:text-data transition-colors"
              >
                Pular animação
              </button>
            </div>
          </div>
        )}
        {phase === "final" && data && (
          <div>
            {data.preview && <PreviewBanner />}
            <FinalPodium podium={data.podium} onReplay={replay} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
