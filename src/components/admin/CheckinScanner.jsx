import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { BrowserQRCodeReader } from "@zxing/browser";
import { X, Flashlight, FlashlightOff, Keyboard, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseConfig";

export default function CheckinScanner({ open, onClose, accessToken, onConfirmed }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const processingRef = useRef(false);
  const pendingTicketRef = useRef(null);
  const activeTicketRef = useRef(null);
  const recentScansRef = useRef(new Map());
  const audioCtxRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const isOpenRef = useRef(false);
  const scannerSessionRef = useRef(0);

  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [feedback, setFeedback] = useState(null);

  const vibrate = (pattern) => {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ }
  };

  const playBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.stop(ctx.currentTime + 0.12);
    } catch { /* ignore */ }
  }, []);

  const showFeedback = useCallback((fb) => {
    setFeedback(fb);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 1800);
  }, []);

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

  const drainPendingQueue = useCallback(() => {
    if (!isOpenRef.current) {
      pendingTicketRef.current = null;
      return;
    }
    const next = pendingTicketRef.current;
    if (!next) return;
    pendingTicketRef.current = null;
    // Process immediately without extra delay
    setTimeout(() => {
      if (isOpenRef.current) processTicket(next);
    }, 50);
  }, []);

  const processTicket = async (ticketId) => {
    const tid = ticketId.trim().toUpperCase();
    const sessionId = scannerSessionRef.current;
    if (!/^ENTEC26-[A-F0-9]{12}$/.test(tid)) {
      if (scannerSessionRef.current !== sessionId) return;
      showFeedback({ type: "invalid", message: "QR não reconhecido" });
      vibrate(100);
      if (scannerSessionRef.current !== sessionId) return;
      processingRef.current = false;
      activeTicketRef.current = null;
      drainPendingQueue();
      return;
    }

    const now = Date.now();
    const last = recentScansRef.current.get(tid);
    if (last && now - last < 4000) {
      if (scannerSessionRef.current !== sessionId) return;
      processingRef.current = false;
      activeTicketRef.current = null;
      drainPendingQueue();
      return;
    }

    processingRef.current = true;
    activeTicketRef.current = tid;
    recentScansRef.current.set(tid, now);
    for (const [k, ts] of recentScansRef.current.entries()) {
      if (now - ts > 10000) recentScansRef.current.delete(k);
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "confirm", ticket_id: tid }),
      });
      const data = await res.json().catch(() => ({}));
      if (scannerSessionRef.current !== sessionId) return;
      if (!res.ok) {
        if (res.status === 404) {
          showFeedback({ type: "notfound", message: "Credencial não encontrada" });
          vibrate(100);
        } else {
          showFeedback({ type: "error", message: data.error || "Falha ao confirmar" });
          vibrate(100);
        }
        return;
      }
      const participant = data.participant;
      const name = participant?.name || tid;
      if (data.status === "already_confirmed") {
        const when = participant?.attendance_confirmed_at ? new Date(participant.attendance_confirmed_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
        showFeedback({ type: "already", name, message: when ? `Já credenciado às ${when.split(",")[1]?.trim() || when}` : "Já credenciado" });
        vibrate(60);
      } else if (data.status === "confirmed" || data.ok) {
        showFeedback({ type: "confirmed", name, message: "Presença confirmada" });
        vibrate([60, 30, 60]);
        playBeep();
        if (onConfirmed) onConfirmed(participant);
      } else {
        showFeedback({ type: "confirmed", name, message: "Presença confirmada" });
        vibrate([60, 30, 60]);
        playBeep();
        if (onConfirmed && participant) onConfirmed(participant);
      }
    } catch (e) {
      if (scannerSessionRef.current !== sessionId) return;
      showFeedback({ type: "error", message: "Falha de conexão" });
      vibrate(100);
    } finally {
      if (scannerSessionRef.current !== sessionId) return;
      processingRef.current = false;
      activeTicketRef.current = null;
      drainPendingQueue();
    }
  };

  const queueTicket = (ticketId) => {
    const tid = ticketId.trim().toUpperCase();
    if (!/^ENTEC26-[A-F0-9]{12}$/.test(tid)) {
      // QR inválido não entra na fila
      const now = Date.now();
      const key = `invalid:${tid.slice(0, 30)}`;
      const last = recentScansRef.current.get(key);
      if (last && now - last < 3000) return;
      recentScansRef.current.set(key, now);
      showFeedback({ type: "invalid", message: "QR não reconhecido" });
      vibrate(100);
      return;
    }

    // Não enfileirar mesmo QR que está ativo
    if (tid === activeTicketRef.current) return;
    // Não duplicar se já está pendente
    if (tid === pendingTicketRef.current) return;

    // Respeitar dedupe (cooldown) antes de enfileirar
    const now = Date.now();
    const last = recentScansRef.current.get(tid);
    if (last && now - last < 4000) return;

    if (processingRef.current) {
      // Fila de apenas 1
      if (pendingTicketRef.current) return;
      pendingTicketRef.current = tid;
      // Não registrar no recentScans ainda — só quando começar a processar
    } else {
      processTicket(tid);
    }
  };

  const handleDetected = useCallback((raw) => {
    const text = raw.trim().toUpperCase();
    // QR válido ENTEC entra na fila/processamento, inválido tem feedback discreto com dedupe
    if (!/^ENTEC26-[A-F0-9]{12}$/.test(text)) {
      const now = Date.now();
      const key = `invalid:${text.slice(0, 30)}`;
      const last = recentScansRef.current.get(key);
      if (last && now - last < 3000) return;
      recentScansRef.current.set(key, now);
      showFeedback({ type: "invalid", message: "QR não reconhecido" });
      vibrate(100);
      return;
    }
    queueTicket(text);
  }, [accessToken]);

  const startCamera = useCallback(async () => {
    if (!open || !videoRef.current) return;
    setCameraError("");
    try {
      if (!audioCtxRef.current && (window.AudioContext || window.webkitAudioContext)) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
      }
    } catch { /* ignore */ }
    try {
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };
      let controls;
      if (typeof reader.decodeFromConstraints === "function") {
        controls = await reader.decodeFromConstraints(constraints, videoRef.current, (result) => {
          if (result) handleDetected(result.getText());
        });
        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
          setTimeout(checkTorch, 500);
        }
      } else {
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result) handleDetected(result.getText());
        });
        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
          setTimeout(checkTorch, 500);
        }
      }
      controlsRef.current = controls;
    } catch (e) {
      setCameraError(e.message || "Não foi possível acessar a câmera.");
    }
  }, [open, handleDetected, checkTorch]);

  useEffect(() => {
    isOpenRef.current = open;
    if (open) {
      scannerSessionRef.current += 1;
      // Fila vazia ao abrir
      pendingTicketRef.current = null;
      activeTicketRef.current = null;
      processingRef.current = false;
      recentScansRef.current.clear();
      const t = setTimeout(startCamera, 200);
      return () => clearTimeout(t);
    } else {
      scannerSessionRef.current += 1;
      // Ao fechar: limpar fila e parar câmera
      pendingTicketRef.current = null;
      activeTicketRef.current = null;
      processingRef.current = false;
      recentScansRef.current.clear();
      stopCamera();
      setFeedback(null);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      setManualMode(false);
      setManualCode("");
      setCameraError("");
    }
  }, [open, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      isOpenRef.current = false;
      pendingTicketRef.current = null;
      activeTicketRef.current = null;
      processingRef.current = false;
      stopCamera();
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, [stopCamera]);

  const handleManualConfirm = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    // Reutiliza mesma fila para consistência
    queueTicket(code);
    setManualCode("");
  };

  const handleClose = () => {
    isOpenRef.current = false;
    pendingTicketRef.current = null;
    activeTicketRef.current = null;
    processingRef.current = false;
    recentScansRef.current.clear();
    stopCamera();
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedback(null);
    onClose?.();
  };

  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-black/80 backdrop-blur-md shrink-0">
        <div>
          <h2 className="text-sm font-bold tracking-[0.14em] uppercase text-white">Credenciamento</h2>
          <p className="text-xs text-white/60 hidden sm:block">Aponte para o QR da credencial</p>
        </div>
        <button
          onClick={handleClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Camera fullscreen */}
      <div className="relative flex-1 w-full h-full bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Indicador sutil 4 cantos bem abertos, sem escurecer */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-[88%] max-w-[360px] aspect-square">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/30 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/30 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/30 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/30 rounded-br-lg" />
          </div>
        </div>

        {/* Texto discreto */}
        <div className="pointer-events-none absolute bottom-20 sm:bottom-24 inset-x-0 flex justify-center px-4">
          <p className="text-xs tracking-[0.12em] uppercase font-medium text-white/80 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
            Aponte para o QR da credencial
          </p>
        </div>

        {/* Feedback flutuante sobre a câmera */}
        {feedback && (
          <div className="pointer-events-none absolute top-4 inset-x-0 flex justify-center px-4 z-10">
            <div
              className={`w-full max-w-[360px] rounded-2xl border backdrop-blur-xl px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)] flex items-center gap-3 animate-[fade-in_200ms_ease] ${
                feedback.type === "confirmed"
                  ? "bg-emerald-500 text-white border-emerald-400/50"
                  : feedback.type === "already"
                  ? "bg-amber-500 text-white border-amber-400/50"
                  : feedback.type === "notfound" || feedback.type === "invalid"
                  ? "bg-red-500/90 text-white border-red-400/50"
                  : "bg-white/95 text-void border-white/20"
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${feedback.type === "confirmed" ? "bg-white/20" : feedback.type === "already" ? "bg-white/20" : "bg-white/20"}`}>
                {feedback.type === "confirmed" ? <CheckCircle2 className="h-5 w-5" /> : feedback.type === "already" ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-bold leading-tight truncate">
                  {feedback.type === "confirmed" ? "Presença confirmada" : feedback.type === "already" ? "Já credenciado" : feedback.type === "invalid" ? "QR não reconhecido" : feedback.type === "notfound" ? "Credencial não encontrada" : "Erro"}
                </p>
                <p className="text-xs font-medium opacity-90 truncate">{feedback.name || feedback.message}</p>
                {feedback.type === "already" && feedback.message && (
                  <p className="text-[11px] opacity-80 truncate">{feedback.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Erro câmera */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/80">
            <div className="w-full max-w-[360px] rounded-2xl bg-white p-6 text-center">
              <p className="text-sm font-medium text-void">{cameraError}</p>
              <p className="mt-2 text-xs text-dim/60">Verifique permissão da câmera e tente novamente.</p>
            </div>
          </div>
        )}
      </div>

      {/* Controles inferiores */}
      <div className="shrink-0 border-t border-white/10 bg-black/90 backdrop-blur-md p-4 sm:p-4">
        <div className="mx-auto w-full max-w-[420px] flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            {torchSupported && (
              <button
                onClick={toggleTorch}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition"
              >
                {torchOn ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
                {torchOn ? "Desligar lanterna" : "Lanterna"}
              </button>
            )}
            <button
              onClick={() => setManualMode((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition"
            >
              <Keyboard className="h-4 w-4" />
              Digitar código
            </button>
          </div>

          {manualMode && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="ENTEC26-XXXXXXXXXXXX"
                className="flex-1 min-w-0 rounded-xl bg-black/40 border border-white/10 px-4 py-2.5 text-sm font-mono text-white placeholder:text-white/40 outline-none focus:border-white/30"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                onClick={handleManualConfirm}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white text-black px-4 py-2.5 text-xs font-bold uppercase tracking-wide hover:bg-white/90 transition"
              >
                <Search className="h-4 w-4" />
                Confirmar
              </button>
            </div>
          )}

          <button
            onClick={handleClose}
            className="inline-flex items-center justify-center w-full rounded-full bg-white/10 border border-white/15 px-6 py-3 text-sm font-medium tracking-[0.08em] uppercase text-white hover:bg-white/20 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
