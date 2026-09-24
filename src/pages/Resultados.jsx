import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Trophy, Loader2, RotateCcw, AlertTriangle, Clock } from "lucide-react";
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

// Sequência da revelação (3º → 2º → 1º): cada colocação entra GRANDE no
// centro como protagonista e, depois de revelada, REDUZ e VIAJA para sua
// posição lateral definitiva. Durações em ms por etapa (~17s no total).
const REVEAL_STEPS = [
  "prep",
  "third-in",
  "third-hold",
  "third-name",
  "third-out",
  "second-in",
  "second-hold",
  "second-name",
  "second-out",
  "anticipation",
  "spotlight",
  "first-base",
  "first-number",
  "first-name",
];
const REVEAL_DURATIONS = [1000, 700, 1000, 1500, 900, 800, 1200, 1500, 900, 900, 1200, 800, 1800, 2600];

const EASE = [0.22, 1, 0.36, 1];

function Eyebrow({ children }) {
  return (
    <p className="text-[11px] sm:text-xs font-medium tracking-[0.3em] uppercase text-lavender/80">
      {children}
    </p>
  );
}

function ChromeTitle({ children, className }) {
  return (
    <h1
      className={`font-tech font-extrabold tracking-[0.04em] text-transparent bg-clip-text bg-gradient-to-r from-[#5F636A] via-white to-[#5F636A] bg-[length:200%_auto] animate-shimmer ${className || ""}`}
      style={{ filter: "drop-shadow(0 0 26px rgba(220,223,230,0.28))", animationDuration: "6s" }}
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
function PlaceCard({ pos, name, score, variant }) {
  const isFirst = variant === "first";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl backdrop-blur-md border px-4 py-6 sm:py-8 text-center ${
        isFirst
          ? "border-signal/50 bg-gradient-to-b from-white/[0.10] via-energy/60 to-void shadow-[0_0_60px_rgba(220,223,230,0.18)]"
          : variant === "second"
            ? "border-signal/30 bg-gradient-to-b from-white/[0.06] to-void/70"
            : "border-signal/20 bg-gradient-to-b from-white/[0.04] to-void/70"
      }`}
    >
      {/* reflexo metálico superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.10] to-transparent" />
      {/* detalhe discreto: ouro muito sutil no 1º, bronze discreto no 3º */}
      {isFirst && (
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" />
      )}
      {variant === "third" && (
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-700/40 to-transparent" />
      )}
      <div
        className={`font-tech font-extrabold leading-none ${
          isFirst
            ? "text-5xl sm:text-7xl text-transparent bg-clip-text bg-gradient-to-b from-white via-lavender to-pulse"
            : "text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-lavender/90 to-pulse/60"
        }`}
      >
        {pos.replace("º", "")}
      </div>
      <div className="mt-1 text-[10px] sm:text-xs uppercase tracking-[0.24em] text-dim/60">
        {pos} lugar
      </div>
      <div
        className={`mx-auto mt-4 max-w-full font-semibold leading-tight text-balance break-words ${
          isFirst ? "text-xl sm:text-3xl text-data" : "text-base sm:text-xl text-data/95"
        }`}
      >
        {name}
      </div>
      <div className="mt-2 text-xs sm:text-sm uppercase tracking-[0.2em] text-lavender/70">
        Nota {formatScore(score)}
      </div>
    </div>
  );
}

function FinalPodium({ podium, onReplay }) {
  return (
    <div className="text-center">
      <Eyebrow>ENTEC 2026 · Resultado oficial</Eyebrow>
      <ChromeTitle className="mt-3 text-3xl sm:text-5xl">PÓDIO — MELHORES STANDS</ChromeTitle>
      <Hairline />

      <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 sm:grid-cols-3 items-stretch sm:items-end gap-2 sm:gap-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="col-span-2 sm:col-span-1 sm:order-2"
        >
          <PlaceCard pos="1º" name={podium.first} score={podium.firstScore} variant="first" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
          className="sm:order-1"
        >
          <PlaceCard pos="2º" name={podium.second} score={podium.secondScore} variant="second" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24, ease: EASE }}
          className="sm:order-3"
        >
          <PlaceCard pos="3º" name={podium.third} score={podium.thirdScore} variant="third" />
        </motion.div>
      </div>

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

// Largura real do palco, para calcular o deslocamento lateral em px.
function useStageWidth(ref) {
  const [w, setW] = useState(360);
  useEffect(() => {
    const update = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect && rect.width > 0) setW(rect.width);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ref]);
  return w;
}

// Facho do holofote: trapézio de luz suave vindo de cima.
function Beam({ rotate, width, strength, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, strength, strength * 0.82, strength] }}
      transition={{ duration: 3.4, delay, repeat: Infinity, ease: "easeInOut" }}
      className={`pointer-events-none absolute -top-[8%] left-1/2 h-[116%] origin-top -translate-x-1/2 ${width} ${rotate}`}
      style={{
        clipPath: "polygon(36% 0, 64% 0, 100% 100%, 0% 100%)",
        background:
          "linear-gradient(to bottom, rgba(232,233,236,0.30), rgba(232,233,236,0.08) 55%, transparent 85%)",
        filter: "blur(7px)",
      }}
    />
  );
}

// Cartão viajante: o mesmo elemento desliza do centro (grande) para a
// lateral (menor), com o conteúdo se adaptando ao tamanho.
function TravelCard({ digit, label, name, score, phase, pose, x, y, width, dimmed, champion, z }) {
  const fg = pose === "fg";
  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ zIndex: z }}
    >
      <motion.div
        initial={{ opacity: 0, y: 70 }}
        animate={{ opacity: phase === "hidden" ? 0 : dimmed ? 0.35 : 1, x, y, width }}
        transition={{ type: "spring", stiffness: 64, damping: 19 }}
        style={{ width }}
        className={`overflow-hidden rounded-2xl sm:rounded-3xl border backdrop-blur-md text-center ${
          champion && phase === "named"
            ? "border-signal/60 bg-gradient-to-b from-white/[0.12] via-energy/60 to-void shadow-[0_0_60px_rgba(220,223,230,0.25)]"
            : "border-signal/30 bg-gradient-to-b from-white/[0.07] to-void/80"
        } ${fg ? "px-6 py-8 sm:px-10 sm:py-10" : "px-2 py-3 sm:px-3 sm:py-4"}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/[0.10] to-transparent" />
        {champion && phase === "named" && (
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${pose}-${phase}`}
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {phase === "hidden" && <div className={fg ? "h-40" : "h-20"} />}

            {phase === "pedestal" && (
              <div className="flex flex-col items-center">
                <div className="flex h-20 sm:h-28 w-3/4 items-center justify-center rounded-xl border border-signal/40 bg-white/[0.04] animate-pulse" aria-hidden="true">
                  <span className="font-tech text-2xl sm:text-3xl text-white/25 select-none">?</span>
                </div>
                <div className="mt-3 flex gap-1.5" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                      className="h-1 w-1 rounded-full bg-lavender/80"
                    />
                  ))}
                </div>
              </div>
            )}

            {phase === "base" && (
              <div className="flex flex-col items-center">
                <div
                  className={`font-tech font-extrabold leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-lavender to-pulse ${
                    fg ? (champion ? "text-7xl sm:text-9xl" : "text-6xl sm:text-8xl") : "text-3xl"
                  }`}
                  style={champion && fg ? { filter: "drop-shadow(0 0 30px rgba(220,223,230,0.5))" } : undefined}
                >
                  {digit}
                </div>
                <div
                  className={`mt-1 uppercase text-dim/60 ${
                    fg ? "text-[11px] sm:text-xs tracking-[0.24em]" : "text-[9px] tracking-[0.18em]"
                  }`}
                >
                  {label} lugar
                </div>
                {fg && (
                  <div className="mt-3 flex gap-1.5" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                        className="h-1 w-1 rounded-full bg-lavender/80"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {phase === "named" && (
              <div className="flex w-full flex-col items-center">
                <div
                  className={`font-tech font-extrabold leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-lavender to-pulse ${
                    fg ? (champion ? "text-6xl sm:text-8xl" : "text-5xl sm:text-7xl") : "text-2xl"
                  }`}
                  style={champion && fg ? { filter: "drop-shadow(0 0 28px rgba(220,223,230,0.45))" } : undefined}
                >
                  {digit}
                </div>
                <p
                  className={`mt-1.5 w-full font-semibold leading-tight break-words ${
                    fg
                      ? champion
                        ? "text-xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-[#8a8e96] via-white to-[#8a8e96] bg-[length:200%_auto] animate-shimmer"
                        : "text-2xl sm:text-4xl text-data"
                      : "text-[11px] leading-tight text-data/95"
                  }`}
                  style={
                    fg && champion
                      ? { animationDuration: "4s", filter: "drop-shadow(0 0 20px rgba(220,223,230,0.4))" }
                      : undefined
                  }
                >
                  {name}
                </p>
                <p
                  className={`mt-1 uppercase text-lavender/75 ${
                    fg ? "text-xs sm:text-sm tracking-[0.22em]" : "text-[9px] tracking-[0.16em]"
                  }`}
                >
                  Nota {formatScore(score)}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
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

function RevealStage({ step, podium }) {
  const stageRef = useRef(null);
  const stageW = useStageWidth(stageRef);
  const key = REVEAL_STEPS[step];
  const spot = step >= 13 ? 2 : step >= 10 ? 1 : 0;
  const dimSides = step >= 9;

  const fgW = Math.min(stageW * 0.82, 440);
  const sideW = Math.max(96, Math.min(170, stageW * 0.27));
  const sideX = Math.max(0, stageW / 2 - sideW / 2 - 8);
  return (
    <div className="relative flex min-h-[62vh] flex-col items-center justify-center overflow-hidden text-center">
      {/* holofote do 1º lugar: penumbra + fachos convergindo ao centro */}
      <AnimatePresence>
        {spot > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute left-1/2 top-[6%] h-1/2 w-[88%] max-w-xl -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse,rgba(226,227,230,0.15)_0%,transparent_70%)]" />
            <Beam rotate="-rotate-[14deg]" width="w-20 sm:w-36" strength={spot === 2 ? 0.85 : 0.5} delay={0} />
            <Beam rotate="" width="w-24 sm:w-44" strength={spot === 2 ? 1 : 0.6} delay={0.4} />
            <Beam rotate="rotate-[14deg]" width="w-20 sm:w-36" strength={spot === 2 ? 0.85 : 0.5} delay={0.8} />
            <div className="absolute bottom-[4%] left-1/2 h-16 w-3/4 max-w-md -translate-x-1/2 rounded-[100%] bg-[radial-gradient(ellipse,rgba(226,227,230,0.22)_0%,transparent_70%)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* partículas discretas no clímax do 1º lugar */}
      {key === "first-name" &&
        PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 0.9, 0], y: -34 }}
            transition={{ duration: 2.2, delay: p.delay, ease: "easeOut" }}
            className="pointer-events-none absolute h-1 w-1 rounded-full bg-lavender/80"
            style={{ left: p.left, top: p.top }}
          />
        ))}

      {/* legenda da etapa */}
      <div className="relative mb-4 sm:mb-6 flex min-h-[72px] sm:min-h-[96px] w-full items-center justify-center px-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            transition={{ duration: 0.45, ease: EASE }}
            className="w-full"
          >
            {key === "prep" && (
              <>
                <Eyebrow>ENTEC 2026 · Resultado oficial</Eyebrow>
                <p className="mt-2 font-tech text-2xl sm:text-4xl font-extrabold tracking-[0.06em] text-data">
                  RESULTADOS
                </p>
              </>
            )}
            {key === "third-base" && (
              <>
                <p className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-lavender/80">
                  Revelando o
                </p>
                <p className="mt-2 font-tech text-2xl sm:text-4xl font-extrabold tracking-[0.05em] text-data">
                  3º LUGAR
                </p>
              </>
            )}
            {key === "second-base" && (
              <>
                <p className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-lavender/80">
                  Revelando o
                </p>
                <p className="mt-2 font-tech text-2xl sm:text-4xl font-extrabold tracking-[0.05em] text-data">
                  2º LUGAR
                </p>
              </>
            )}
            {key === "first-base" && (
              <p className="text-xs sm:text-sm uppercase tracking-[0.24em] text-lavender/85">
                E o campeão do ENTEC 2026 é…
              </p>
            )}
            {key === "first-name" && (
              <>
                <Trophy className="mx-auto h-6 w-6 sm:h-8 sm:w-8 text-lavender" />
                <p className="mt-2 text-xs sm:text-sm uppercase tracking-[0.3em] text-lavender/80">
                  Campeão · ENTEC 2026
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* palco: protagonistas viajam do centro para as laterais */}
      <div ref={stageRef} className="relative z-10 h-[48vh] min-h-[360px] w-full">
        {[
          { place: "third", digit: "3", label: "3º", name: podium.third, score: podium.thirdScore, champion: false },
          { place: "second", digit: "2", label: "2º", name: podium.second, score: podium.secondScore, champion: false },
          { place: "first", digit: "1", label: "1º", name: podium.first, score: podium.firstScore, champion: true },
        ].map((c) => {
          const phase = revealPhase(c.place, step);
          const pose = revealPose(c.place, step);
          const isFg = pose === "fg";
          return (
            <TravelCard
              key={c.place}
              digit={c.digit}
              label={c.label}
              name={c.name}
              score={c.score}
              phase={phase}
              pose={pose}
              x={pose === "left" ? -sideX : pose === "right" ? sideX : 0}
              y={isFg ? 0 : 46}
              width={isFg ? fgW : sideW}
              dimmed={!isFg && dimSides}
              champion={c.champion}
              z={isFg ? 30 : 10}
            />
          );
        })}
      </div>
      {key === "first-name" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 z-40 bg-white"
        />
      )}
    </div>
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
        const podium = { first: res.first, second: res.second, third: res.third };
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
          <div>
            {data.preview && <PreviewBanner />}
            <RevealStage step={stepIndex} podium={data.podium} />
            <div className="mt-2 text-center">
              <button
                onClick={skipReveal}
                className="text-xs uppercase tracking-[0.22em] text-dim/50 hover:text-lavender transition-colors"
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
