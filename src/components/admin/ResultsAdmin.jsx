import React, { useEffect, useMemo, useState } from "react";
import { Trophy, Loader2, CheckCircle2, Megaphone } from "lucide-react";
import {
  STAND_GROUPS,
  computeRanking,
  formatScore,
  getAdminResults,
  saveScores,
  releaseResults,
} from "@/lib/standResults";

function formatReleasedAt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

function parseNota(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return Math.round(n * 100) / 100;
}

export default function ResultsAdmin({ accessToken }) {
  const [loading, setLoading] = useState(true);
  const [notas, setNotas] = useState({});
  const [released, setReleased] = useState(false);
  const [releasedAt, setReleasedAt] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await getAdminResults(accessToken);
      const saved = res.scores || {};
      const initial = {};
      STAND_GROUPS.forEach((g) => {
        initial[g] = saved[g] !== undefined && saved[g] !== null ? String(saved[g]) : "";
      });
      setNotas(initial);
      setReleased(Boolean(res.results_released));
      setReleasedAt(res.released_at || null);
    } catch (e) {
      setError(e.message || "Falha ao carregar resultados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const parsed = useMemo(() => {
    const out = {};
    STAND_GROUPS.forEach((g) => {
      out[g] = parseNota(notas[g]);
    });
    return out;
  }, [notas]);

  const filledCount = useMemo(
    () => STAND_GROUPS.filter((g) => parsed[g] !== null).length,
    [parsed]
  );
  const complete = filledCount === STAND_GROUPS.length;

  // Prévia da classificação calculada ao vivo, conforme digita.
  const ranking = useMemo(() => computeRanking(parsed), [parsed]);
  const top3 = ranking.slice(0, 3);

  const handleSave = async () => {
    if (!complete || saving) return;
    setError("");
    setNotice("");
    if (released) {
      const ok = window.confirm(
        "Os resultados já foram divulgados. Alterar as notas modificará uma informação pública. Deseja continuar?"
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await saveScores(accessToken, parsed);
      setReleased(Boolean(res.results_released ?? released));
      setReleasedAt(res.released_at ?? releasedAt);
      const r = res.ranking || [];
      const resumo = r.slice(0, 3).map((x, i) => `${i + 1}º ${x.group} (${formatScore(x.score)})`).join(" · ");
      setNotice(
        released
          ? `Notas atualizadas e nova versão publicada — ${resumo}.`
          : `Notas salvas. Classificação: ${resumo}. Ainda NÃO está visível ao público — use “Liberar resultados” na hora oficial.`
      );
    } catch (e) {
      setError(e.message || "Falha ao salvar as notas.");
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!complete || releasing) return;
    setError("");
    setNotice("");
    setShowConfirm(false);
    setReleasing(true);
    try {
      const res = await releaseResults(accessToken);
      setReleased(true);
      setReleasedAt(res.released_at || new Date().toISOString());
      setNotice("Resultados divulgados oficialmente. A página /resultados agora exibe o pódio com as notas.");
    } catch (e) {
      setError(e.message || "Falha ao liberar os resultados.");
    } finally {
      setReleasing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-lavender" />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-2xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-md px-5 py-5 mb-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-lavender" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-data">
            Resultados — Notas dos stands
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-dim/60">
          Lance a nota de cada grupo (0 a 10). O site classifica sozinho pela maior nota —
          empate é desempatado por ordem alfabética. Salvar não divulga: o público só vê
          após “Liberar resultados”.
        </p>
        {released ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              RESULTADOS DIVULGADOS ✓
            </p>
            <p className="mt-1 text-xs text-emerald-200/70">
              Divulgado em: {formatReleasedAt(releasedAt)}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-signal/20 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-dim/70">
              {complete
                ? "Notas prontas. Salve e libere manualmente no horário oficial."
                : `Faltam ${STAND_GROUPS.length - filledCount} de ${STAND_GROUPS.length} notas para completar.`}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {STAND_GROUPS.map((g) => (
          <div
            key={g}
            className="flex items-center justify-between gap-3 rounded-xl border border-signal/15 bg-white/[0.02] px-4 py-3"
          >
            <label htmlFor={`nota-${g}`} className="text-sm font-medium text-data/90 break-words">
              {g}
            </label>
            <input
              id={`nota-${g}`}
              type="number"
              min="0"
              max="10"
              step="0.1"
              inputMode="decimal"
              placeholder="0–10"
              value={notas[g] || ""}
              onChange={(e) => setNotas((prev) => ({ ...prev, [g]: e.target.value }))}
              disabled={saving || releasing}
              className="w-24 shrink-0 rounded-lg bg-void/60 border border-signal/20 px-3 py-2 text-center text-sm text-data outline-none focus:border-signal/60 disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      {/* Prévia ao vivo da classificação */}
      <div className="mt-5 rounded-2xl border border-signal/20 bg-white/[0.02] px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-lavender/70 font-medium">
          Prévia da classificação
        </p>
        {ranking.length === 0 ? (
          <p className="mt-2 text-sm text-dim/60">Digite as notas para ver o pódio se formando aqui.</p>
        ) : (
          <ol className="mt-3 space-y-1.5">
            {ranking.map((r, i) => (
              <li
                key={r.group}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                  i < 3
                    ? "border border-signal/30 bg-signal/10 text-data font-semibold"
                    : "text-dim/70"
                }`}
              >
                <span className="break-words">
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px]">
                    {i + 1}
                  </span>
                  {r.group}
                </span>
                <span className="font-tech text-xs tracking-wider whitespace-nowrap">
                  {formatScore(r.score)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!complete || saving || releasing}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-signal/30 bg-signal/10 px-7 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-data transition-all hover:bg-signal/20 disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Salvando…" : "Salvar notas"}
        </button>
        {!released && (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!complete || saving || releasing}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-data px-7 py-3 text-xs font-bold uppercase tracking-[0.16em] text-void shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-all hover:scale-[1.02] disabled:opacity-40"
          >
            <Megaphone className="h-4 w-4" />
            Liberar resultados
          </button>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-signal/25 bg-void p-6 shadow-2xl">
            <h3 className="font-tech text-lg font-bold tracking-[0.04em] text-data">
              LIBERAR RESULTADOS?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-dim/80">
              Tem certeza que deseja divulgar oficialmente o pódio? Após a liberação, os
              visitantes poderão visualizar os vencedores e as notas.
            </p>
            <div className="mt-4 rounded-xl border border-signal/15 bg-white/[0.03] px-4 py-3 text-sm text-data/90">
              {top3.map((t, i) => (
                <p key={t.group}>
                  {i + 1}º — {t.group} ({formatScore(t.score)})
                </p>
              ))}
            </div>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={releasing}
                className="rounded-full border border-signal/25 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-dim/70 transition-all hover:text-data hover:border-signal/50 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleRelease}
                disabled={releasing}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-data px-6 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-void transition-all hover:scale-[1.02] disabled:opacity-40"
              >
                {releasing && <Loader2 className="h-4 w-4 animate-spin" />}
                {releasing ? "Liberando…" : "Liberar resultados"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
