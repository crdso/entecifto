import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { BrowserQRCodeReader } from "@zxing/browser";
import { X, Flashlight, FlashlightOff, Keyboard, Search, Loader2, CheckCircle2, AlertTriangle, QrCode } from "lucide-react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseConfig";

export default function CheckinScanner({ open, onClose, accessToken, onConfirmed }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const streamRef = useRef(null);
  const processingRef = useRef(false);
  const readerRef = useRef(null);

  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | scanning | found | already | notfound | error
  const [participant, setParticipant] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [lastTicket, setLastTicket] = useState("");

  const vibrate = (pattern) => {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ }
  };

  const stopCamera = useCallback(() => {
    try {
      if (controlsRef.current && typeof controlsRef.current.stop === "function") {
        controlsRef.current.stop();
      }
    } catch { /* ignore */ }
    controlsRef.current = null;
    readerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  const checkTorch = useCallback(() => {
    try {
      const stream = streamRef.current || videoRef.current?.srcObject;
      if (!stream) return;
      const track = stream.getVideoTracks?.()[0];
      if (!track) return;
      const caps = track.getCapabilities?.();
      if (caps && "torch" in caps) setTorchSupported(true);
    } catch { /* ignore */ }
  }, []);

  const toggleTorch = async () => {
    try {
      const stream = streamRef.current || videoRef.current?.srcObject;
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return;
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((v) => !v);
    } catch { /* ignore */ }
  };

  const lookupTicket = async (ticketId) => {
    const tid = ticketId.trim().toUpperCase();
    if (!/^ENTEC26-[A-F0-9]{12}$/.test(tid)) {
      setStatus("notfound");
      setParticipant(null);
      setErrorMsg("Formato inválido. Use ENTEC26-XXXXXXXXXXXX");
      return;
    }
    setLastTicket(tid);
    setStatus("found");
    // actual lookup will be done via effect? We do lookup here
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "lookup", ticket_id: tid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setStatus("notfound");
          setErrorMsg(data.error || "Credencial não encontrada.");
          vibrate(80);
          return;
        }
        throw new Error(data.error || `Erro ${res.status}`);
      }
      if (data.status === "already_confirmed") {
        setStatus("already");
        setParticipant(data.participant);
        vibrate([70, 40, 70]);
      } else {
        setStatus("found");
        setParticipant(data.participant);
        vibrate(80);
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "Falha ao consultar.");
    }
  };

  const handleDetected = useCallback((ticketId) => {
    if (processingRef.current) return;
    processingRef.current = true;
    stopCamera();
    lookupTicket(ticketId);
  }, [accessToken]);

  const startCamera = useCallback(async () => {
    if (!open || !videoRef.current) return;
    processingRef.current = false;
    setStatus("scanning");
    setParticipant(null);
    setErrorMsg("");
    setLastTicket("");
    try {
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      // Use decodeFromConstraints if available, else fallback to decodeFromVideoDevice
      let controls;
      if (typeof reader.decodeFromConstraints === "function") {
        controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result, err) => {
            if (result) {
              const text = result.getText().trim();
              handleDetected(text);
            }
          }
        );
        // Try to capture stream for torch
        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
          setTimeout(checkTorch, 500);
        }
      } else {
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
          if (result) {
            const text = result.getText().trim();
            handleDetected(text);
          }
        });
        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
          setTimeout(checkTorch, 500);
        }
      }
      controlsRef.current = controls;
      // Also try to get stream via getUserMedia for torch detection if not yet
      if (!streamRef.current && navigator.mediaDevices?.getUserMedia) {
        try {
          const s = await navigator.mediaDevices.getUserMedia(constraints);
          // don't replace video stream, just check torch
          s.getTracks().forEach((t) => t.stop());
        } catch { /* ignore */ }
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "Não foi possível acessar a câmera.");
    }
  }, [open, handleDetected, checkTorch]);

  useEffect(() => {
    if (open) {
      // small delay to ensure video element mounted
      const t = setTimeout(startCamera, 300);
      return () => clearTimeout(t);
    } else {
      stopCamera();
      setStatus("idle");
      setParticipant(null);
      setErrorMsg("");
      setLastTicket("");
      setManualMode(false);
      setManualCode("");
      processingRef.current = false;
    }
  }, [open, startCamera, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleConfirm = async () => {
    if (!lastTicket) return;
    setConfirming(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: "confirm", ticket_id: lastTicket }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      // success
      const p = data.participant;
      setParticipant(p);
      setStatus("already");
      vibrate([70, 40, 70]);
      if (onConfirmed) onConfirmed(p);
    } catch (e) {
      setErrorMsg(e.message || "Falha ao confirmar.");
      setStatus("error");
    } finally {
      setConfirming(false);
    }
  };

  const handleManualLookup = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    processingRef.current = true;
    stopCamera();
    lookupTicket(code);
  };

  const handleScanNext = () => {
    processingRef.current = false;
    setStatus("idle");
    setParticipant(null);
    setErrorMsg("");
    setLastTicket("");
    setManualMode(false);
    setManualCode("");
    setTimeout(startCamera, 200);
  };

  const handleClose = () => {
    stopCamera();
    processingRef.current = false;
    onClose?.();
  };

  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[200] flex flex-col bg-void/95 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.08] bg-[rgba(23,23,25,0.8)] backdrop-blur-md">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.14em] uppercase text-data">Credenciamento</h2>
          <p className="text-xs text-dim/60">Escaneie a credencial ENTEC 2026</p>
        </div>
        <button
          onClick={handleClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-data hover:bg-white/[0.10] transition"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center">
        {status === "scanning" || status === "idle" ? (
          <>
            <div className="relative w-full max-w-[420px] aspect-[3/4] sm:aspect-[4/3] rounded-[24px] overflow-hidden border border-white/10 bg-black shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Moldura QR */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative w-[68%] aspect-square rounded-2xl border-2 border-white/90 shadow-[0_0_0_4000px_rgba(0,0,0,0.45)]">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-xl" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <QrCode className="h-8 w-8 text-white/60" />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-center">
                <p className="text-xs tracking-[0.12em] uppercase font-medium text-white/90">Aponte para o QR da credencial</p>
                <p className="text-[11px] text-white/60 mt-1">Apple Wallet / Google Wallet • ENTEC26-XXXXXXXXXXXX</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              {torchSupported && (
                <button
                  onClick={toggleTorch}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-data hover:bg-white/[0.10] transition"
                >
                  {torchOn ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
                  {torchOn ? "Desligar lanterna" : "Lanterna"}
                </button>
              )}
              <button
                onClick={() => setManualMode((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-data hover:bg-white/[0.10] transition"
              >
                <Keyboard className="h-4 w-4" />
                Digitar código
              </button>
            </div>

            {manualMode && (
              <div className="mt-6 w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <label className="block text-[11px] tracking-[0.14em] uppercase font-medium text-lavender/80 mb-2">Código da credencial</label>
                <div className="flex gap-2">
                  <input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="ENTEC26-XXXXXXXXXXXX"
                    className="flex-1 rounded-xl bg-void/60 border border-white/10 px-4 py-2.5 text-sm font-mono text-data placeholder:text-dim/40 outline-none focus:border-white/25"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  <button
                    onClick={handleManualLookup}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-data text-void px-4 py-2.5 text-xs font-semibold uppercase tracking-wide hover:bg-white transition"
                  >
                    <Search className="h-4 w-4" />
                    Consultar
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleClose}
              className="mt-6 inline-flex items-center justify-center w-full max-w-[420px] rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-medium tracking-[0.08em] uppercase text-data hover:bg-white/[0.08] transition"
            >
              Fechar
            </button>
          </>
        ) : status === "found" && participant ? (
          <div className="w-full max-w-[420px] rounded-[24px] border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-white/[0.02] backdrop-blur-md p-6 sm:p-7">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold tracking-[0.14em] uppercase">
              <CheckCircle2 className="h-5 w-5" />
              Credencial válida
            </div>
            <h3 className="mt-3 font-display font-bold text-xl sm:text-2xl text-data">{participant.name}</h3>
            <p className="mt-1 text-sm text-dim/70 truncate">{participant.email}</p>
            <p className="mt-2 text-xs text-dim/60">
              Inscrito em: {participant.created_at ? new Date(participant.created_at).toLocaleString("pt-BR") : "—"}
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              Presença: Pendente
            </div>
            <div className="mt-6 grid gap-3">
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-emerald-500 text-white px-6 py-4 text-sm font-bold tracking-[0.08em] uppercase shadow-[0_8px_24px_rgba(16,185,129,0.35)] hover:bg-emerald-400 disabled:opacity-60 transition"
              >
                {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Confirmar presença
              </button>
              <button
                onClick={handleScanNext}
                className="inline-flex items-center justify-center w-full rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-medium tracking-[0.08em] uppercase text-data hover:bg-white/[0.08] transition"
              >
                Cancelar / Escanear outro
              </button>
            </div>
          </div>
        ) : status === "already" && participant ? (
          <div className="w-full max-w-[420px] rounded-[24px] border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md p-6 sm:p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-display font-bold text-xl text-data">Já credenciado</h3>
            <p className="mt-2 font-medium text-data">{participant.name}</p>
            <p className="mt-1 text-sm text-dim/70">{participant.email}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 text-white px-3 py-1 text-xs font-bold tracking-wide">
              Presença confirmada
            </div>
            <p className="mt-3 text-xs text-dim/60">
              Confirmada em: {participant.attendance_confirmed_at ? new Date(participant.attendance_confirmed_at).toLocaleString("pt-BR") : "—"}
            </p>
            <button
              onClick={handleScanNext}
              className="mt-6 inline-flex items-center justify-center w-full rounded-full bg-data text-void px-6 py-3.5 text-sm font-semibold tracking-[0.08em] uppercase hover:bg-white transition"
            >
              Escanear próximo
            </button>
          </div>
        ) : status === "notfound" ? (
          <div className="w-full max-w-[420px] rounded-[24px] border border-red-500/20 bg-red-500/10 backdrop-blur-md p-6 sm:p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 text-red-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display font-bold text-lg text-data">Credencial não reconhecida</h3>
            <p className="mt-2 text-sm text-dim/70 leading-relaxed">Este QR não pertence a uma inscrição válida do ENTEC 2026.</p>
            <p className="mt-2 text-xs text-dim/50">{errorMsg}</p>
            <button
              onClick={handleScanNext}
              className="mt-6 inline-flex items-center justify-center w-full rounded-full bg-data text-void px-6 py-3.5 text-sm font-semibold tracking-[0.08em] uppercase hover:bg-white transition"
            >
              Tentar novamente
            </button>
          </div>
        ) : status === "error" ? (
          <div className="w-full max-w-[420px] rounded-[24px] border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-300">{errorMsg || "Erro inesperado."}</p>
            <button onClick={handleScanNext} className="mt-4 inline-flex items-center justify-center w-full rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-medium uppercase text-data">
              Tentar novamente
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  // Portal to body to avoid z-index issues
  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
