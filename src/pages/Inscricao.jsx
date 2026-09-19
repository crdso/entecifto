import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, Award, ArrowRight, BadgeCheck, AlertCircle, X, CheckCircle2, Loader2, Wallet } from "lucide-react";
import Header from "@/components/entec/Header";
import Footer from "@/components/entec/Footer";
import { AppleWalletBadge, GoogleWalletBadge } from "@/components/entec/WalletBadges";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_CONFIGURED } from "@/lib/supabaseConfig";

function maskCPF(v) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidCPF(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(d[10]);
}

function validateInscricao(f) {
  const e = {};
  if ((f.nome || "").trim().length < 3) e.nome = "Informe seu nome completo.";
  const cpfDigits = String(f.cpf || "").replace(/\D/g, "");
  if (cpfDigits.length !== 11) e.cpf = "CPF deve conter 11 dígitos.";
  else if (!isValidCPF(f.cpf)) e.cpf = "CPF inválido.";
  if (!f.nascimento) e.nascimento = "Informe sua data de nascimento.";
  else {
    const d = new Date(f.nascimento);
    const now = new Date();
    if (Number.isNaN(d.getTime())) e.nascimento = "Data inválida.";
    else if (d > now) e.nascimento = "Data não pode ser no futuro.";
    else if (d.getFullYear() < 1900) e.nascimento = "Data muito antiga.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((f.email || "").trim())) e.email = "E-mail inválido.";
  return e;
}

function validateCertificado(f) {
  const e = {};
  const cpfDigits = String(f.cpf || "").replace(/\D/g, "");
  if (cpfDigits.length !== 11) e.cpf = "CPF deve conter 11 dígitos.";
  else if (!isValidCPF(f.cpf)) e.cpf = "CPF inválido.";
  if (!f.nascimento) e.nascimento = "Informe sua data de nascimento.";
  return e;
}

async function callEventRegister(payload) {
  if (!SUPABASE_CONFIGURED) throw new Error("Supabase não configurado.");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/event-register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Falha ao registrar (${res.status}).`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export default function Inscricao() {
  const { toast } = useToast();
  const [form, setForm] = useState({ nome: "", cpf: "", nascimento: "", email: "" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [certForm, setCertForm] = useState({ cpf: "", nascimento: "" });
  const [certErrors, setCertErrors] = useState({});
  const [showCertModal, setShowCertModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [certSubmitting, setCertSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCertField = (k, v) => setCertForm((f) => ({ ...f, [k]: v }));

  const handleInscricao = async (e) => {
    e.preventDefault();
    if (success) return;
    const errs = validateInscricao(form);
    setErrors(errs);
    setTouched({ nome: true, cpf: true, nascimento: true, email: true });
    if (Object.keys(errs).length) {
      toast({
        title: "Verifique os campos",
        description: "Corrija os campos destacados antes de continuar.",
      });
      setTimeout(() => {
        if (errs.nome) document.getElementById("entec-name")?.focus();
        else if (errs.cpf) document.getElementById("entec-cpf")?.focus();
        else if (errs.nascimento) document.getElementById("entec-birth-date")?.focus();
        else if (errs.email) document.getElementById("entec-email")?.focus();
      }, 0);
      return;
    }
    setSubmitting(true);
    try {
      const result = await callEventRegister({
        name: form.nome.trim(),
        cpf: form.cpf,
        birthDate: form.nascimento,
        email: form.email.trim(),
      });
      setSuccess({
        cpf_last4: result.cpf_last4 || form.cpf.replace(/\D/g, "").slice(-4),
        wallet_status: result.wallet_status || "pending",
        wallet_access_token: result.wallet_access_token || null,
        wallet: result.wallet || null,
        wallet_error: result.wallet_error || null,
      });
      if (result.wallet_status === "error") {
        toast({
          title: "Inscrição confirmada!",
          description: "Sua participação foi registrada, mas não foi possível gerar sua credencial digital agora.",
        });
      } else {
        toast({
          title: "Inscrição confirmada!",
          description: "Sua participação no ENTEC 2026 foi registrada com sucesso.",
        });
      }
    } catch (err) {
      const status = err.status || 0;
      let msg = err.message || "Não foi possível concluir sua inscrição. Tente novamente.";
      if (status === 409) msg = "Já existe uma inscrição vinculada a este CPF.";
      else if (status === 400 && /cpf/i.test(msg)) msg = "Informe um CPF válido.";
      else if (status === 400 && /email/i.test(msg)) msg = "Informe um e-mail válido.";
      else if (status >= 500) msg = "Não foi possível concluir sua inscrição. Tente novamente.";
      toast({ title: "Não foi possível concluir", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCertificado = async (e) => {
    e.preventDefault();
    const errs = validateCertificado(certForm);
    setCertErrors(errs);
    if (Object.keys(errs).length) {
      toast({ title: "Verifique os campos", description: "CPF e data de nascimento são obrigatórios." });
      setTimeout(() => {
        if (errs.cpf) document.getElementById("certificate-cpf")?.focus();
        else if (errs.nascimento) document.getElementById("certificate-birth-date")?.focus();
      }, 0);
      return;
    }
    setCertSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-certificate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ cpf: certForm.cpf, birthDate: certForm.nascimento }),
      });
      if (res.ok && res.headers.get("content-type")?.includes("application/pdf")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const disposition = res.headers.get("content-disposition") || "";
        let filename = "certificado-entec-2026.pdf";
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Certificado encontrado", description: "Seu certificado foi gerado com sucesso." });
        return;
      }
      const data = await res.json().catch(() => ({}));
      const msg = data.error || "";
      if (res.status === 404) {
        toast({ title: "Não encontramos uma participação com esses dados.", description: "Verifique CPF e data de nascimento." });
      } else if (res.status === 403 && msg.includes("presença")) {
        toast({ title: "Não há presença confirmada para esta participação.", description: "Sua presença ainda não foi confirmada pela organização." });
      } else if (res.status === 403) {
        toast({ title: "Seu certificado ainda não foi liberado.", description: "Aguarde a liberação pela organização." });
      } else {
        toast({ title: "Não foi possível gerar o certificado agora. Tente novamente.", description: msg || "" });
      }
    } catch {
      toast({ title: "Não foi possível gerar o certificado agora. Tente novamente." });
    } finally {
      setCertSubmitting(false);
    }
  };

  const handleAppleWallet = () => {
    if (!success?.wallet_access_token) return;
    const url = `${SUPABASE_URL}/functions/v1/event-wallet?token=${encodeURIComponent(success.wallet_access_token)}&type=apple`;
    window.location.href = url;
  };
  const handleGoogleWallet = () => {
    if (!success?.wallet_access_token) return;
    // Google uses same wallet token but type google redirects to save_url
    const url = `${SUPABASE_URL}/functions/v1/event-wallet?token=${encodeURIComponent(success.wallet_access_token)}&type=google`;
    window.open(url, "_blank");
  };

  const inputBase =
    "block w-full min-w-0 max-w-full box-border rounded-2xl bg-void/60 border px-4 py-3.5 text-base sm:text-[15px] text-data placeholder:text-dim/70 outline-none transition-all overflow-hidden text-ellipsis [&::-webkit-date-and-time-value]:text-left [&::-webkit-calendar-picker-indicator]:opacity-70";
  const inputOk = "border-white/10 focus:border-white/25 focus:bg-void/80";
  const inputErr = "border-red-500/40 focus:border-red-500/60 bg-red-500/5";

  return (
    <div className="relative min-h-screen text-data font-body overflow-x-hidden">
      <Header />

      <main className="relative px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16">
        <div className="max-w-[760px] mx-auto min-w-0">
          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8 sm:mb-10"
          >
            <h1 className="mt-5 font-tech font-extrabold tracking-[0.04em] leading-none">
              <span className="block text-3xl sm:text-4xl text-dim/90 font-semibold tracking-[0.22em]">INSCRIÇÃO</span>
              <span
                className="block mt-1 text-5xl sm:text-6xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E8E9EC] via-[#B9BCC3] to-white bg-[length:250%_auto] animate-chrome-shimmer"
                style={{ filter: "drop-shadow(0 0 18px rgba(255,255,255,0.12))", animationDuration: "5.5s" }}
              >
                ENTEC 2026
              </span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-data/90">Garanta sua participação no ENTEC 2026.</p>
            <p className="mt-1 text-sm text-dim/70 inline-flex items-center justify-center gap-2 flex-wrap">
              <Calendar className="h-4 w-4 text-signal/80" />
              23 e 24 de setembro · IFTO — Campus Araguatins
            </p>
          </motion.div>

          {/* Main card - inscription form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="relative rounded-[28px] sm:rounded-[32px] border border-white/[0.08] bg-gradient-to-b from-[rgba(32,32,34,0.72)] via-[rgba(23,23,25,0.78)] to-[rgba(12,12,13,0.88)] backdrop-blur-2xl overflow-hidden shadow-[0_24px_80px_-20px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            {/* top metallic highlight */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.07),transparent_70%)] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(185,188,195,0.06),transparent_70%)] blur-2xl" />

            <div className="relative p-6 sm:p-8 md:p-10 min-w-0">
              {success ? (
                <div className="text-center py-6 min-w-0">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="mt-5 font-display font-bold text-2xl sm:text-3xl text-data">Inscrição confirmada!</h2>
                  <p className="mt-3 text-sm sm:text-base text-dim/80 leading-relaxed max-w-lg mx-auto">
                    Sua participação no ENTEC 2026 foi registrada com sucesso.
                  </p>
                  <p className="mt-2 text-xs tracking-[0.16em] uppercase text-lavender/70">23 e 24 de setembro · IFTO — Campus Araguatins</p>

                  {/* Wallet */}
                  {success.wallet_status === "ready" && success.wallet && (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 sm:p-6 text-left">
                      <div className="flex items-center gap-2 text-sm font-medium text-data">
                        <Wallet className="h-4 w-4 text-signal" />
                        Sua credencial digital está pronta.
                      </div>
                      <p className="mt-1 text-xs text-dim/60">Adicione ao seu celular para credenciamento no evento.</p>
                      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center sm:justify-start items-center">
                        {success.wallet.apple_available && (
                          <AppleWalletBadge onClick={handleAppleWallet} />
                        )}
                        {success.wallet.google_available && (
                          <GoogleWalletBadge onClick={handleGoogleWallet} />
                        )}
                      </div>
                      {!success.wallet.apple_available && !success.wallet.google_available && (
                        <p className="mt-3 text-xs text-amber-300">Credencial gerada, mas nenhuma carteira retornou URL. Contate a organização.</p>
                      )}
                    </div>
                  )}

                  {success.wallet_status === "error" && (
                    <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-left">
                      <p className="text-sm font-medium text-amber-200">Inscrição confirmada, mas não foi possível gerar sua credencial digital agora.</p>
                      <p className="mt-1 text-xs text-amber-200/70">Sua inscrição continua válida. A credencial poderá ser gerada posteriormente pela organização.</p>
                    </div>
                  )}

                  {success.wallet_status === "pending" && (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
                      <p className="text-sm text-dim/70">Sua credencial está sendo preparada...</p>
                    </div>
                  )}

                  <p className="mt-6 text-xs text-dim/50">Você pode fechar esta página com segurança.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-7">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-void shadow-[0_4px_16px_rgba(255,255,255,0.18)]">
                      <BadgeCheck className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="font-display font-semibold text-lg sm:text-xl text-data">Formulário de inscrição</h2>
                      <p className="text-xs sm:text-sm text-dim/60">Preencha seus dados para garantir sua vaga.</p>
                    </div>
                  </div>

                  <form onSubmit={handleInscricao} noValidate className="space-y-5 min-w-0 w-full">
                    <div className="min-w-0 w-full">
                      <label htmlFor="entec-name" className="block text-[11px] tracking-[0.16em] uppercase font-medium text-lavender/80 mb-2">
                        Nome completo
                      </label>
                      <input
                        id="entec-name"
                        value={form.nome}
                        onChange={(e) => setField("nome", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, nome: true }))}
                        placeholder="Seu nome completo"
                        autoComplete="name"
                        disabled={submitting}
                        aria-invalid={Boolean(errors.nome && touched.nome)}
                        aria-describedby={errors.nome && touched.nome ? "entec-name-error" : undefined}
                        className={`${inputBase} ${errors.nome && touched.nome ? inputErr : inputOk} disabled:opacity-60`}
                      />
                      {errors.nome && touched.nome && (
                        <p id="entec-name-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-300">
                          <AlertCircle className="h-3.5 w-3.5" /> {errors.nome}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 min-w-0 w-full">
                      <div className="min-w-0">
                        <label htmlFor="entec-cpf" className="block text-[11px] tracking-[0.16em] uppercase font-medium text-lavender/80 mb-2">
                          CPF
                        </label>
                        <input
                          id="entec-cpf"
                          value={form.cpf}
                          onChange={(e) => setField("cpf", maskCPF(e.target.value))}
                          onBlur={() => setTouched((t) => ({ ...t, cpf: true }))}
                          placeholder="000.000.000-00"
                          inputMode="numeric"
                          autoComplete="off"
                          disabled={submitting}
                          aria-invalid={Boolean(errors.cpf && touched.cpf)}
                          aria-describedby={errors.cpf && touched.cpf ? "entec-cpf-error" : undefined}
                          className={`${inputBase} ${errors.cpf && touched.cpf ? inputErr : inputOk} disabled:opacity-60`}
                        />
                        {errors.cpf && touched.cpf && (
                          <p id="entec-cpf-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-300">
                            <AlertCircle className="h-3.5 w-3.5" /> {errors.cpf}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0">
                        <label htmlFor="entec-birth-date" className="block text-[11px] tracking-[0.16em] uppercase font-medium text-lavender/80 mb-2">
                          Data de nascimento
                        </label>
                        <input
                          id="entec-birth-date"
                          type="date"
                          value={form.nascimento}
                          onChange={(e) => setField("nascimento", e.target.value)}
                          onBlur={() => setTouched((t) => ({ ...t, nascimento: true }))}
                          disabled={submitting}
                          aria-invalid={Boolean(errors.nascimento && touched.nascimento)}
                          aria-describedby={errors.nascimento && touched.nascimento ? "entec-birth-date-error" : undefined}
                          className={`${inputBase} ${errors.nascimento && touched.nascimento ? inputErr : inputOk} [color-scheme:dark] disabled:opacity-60`}
                        />
                        {errors.nascimento && touched.nascimento && (
                          <p id="entec-birth-date-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-300">
                            <AlertCircle className="h-3.5 w-3.5" /> {errors.nascimento}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <label htmlFor="entec-email" className="block text-[11px] tracking-[0.16em] uppercase font-medium text-lavender/80 mb-2">
                        E-mail
                      </label>
                      <input
                        id="entec-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setField("email", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                        placeholder="voce@exemplo.com"
                        autoComplete="email"
                        disabled={submitting}
                        aria-invalid={Boolean(errors.email && touched.email)}
                        aria-describedby={errors.email && touched.email ? "entec-email-error" : undefined}
                        className={`${inputBase} ${errors.email && touched.email ? inputErr : inputOk} disabled:opacity-60`}
                      />
                      {errors.email && touched.email && (
                        <p id="entec-email-error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-red-300">
                          <AlertCircle className="h-3.5 w-3.5" /> {errors.email}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="group relative w-full mt-2 inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-data text-void font-semibold text-sm tracking-[0.14em] uppercase overflow-hidden shadow-[0_8px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.6)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.45)] hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-energy"
                    >
                      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                        <span className="absolute inset-y-0 -left-1/2 w-[55%] bg-gradient-to-r from-transparent via-white/50 to-transparent -skew-x-12 translate-x-[-120%] group-hover:translate-x-[240%] transition-transform duration-[1300ms] ease-[cubic-bezier(0.4,0,0.2,1)]" />
                      </span>
                      <span className="relative inline-flex items-center gap-2">
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {submitting ? "Realizando inscrição..." : "Confirmar inscrição"}
                      </span>
                      {!submitting && <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />}
                    </button>

                    <p className="text-center text-[11px] leading-relaxed text-dim/45">
                      Ao se inscrever você concorda com a Política de Privacidade do ENTEC 2026.
                      <br />
                      <span className="text-dim/60">Seus dados serão usados apenas para controle de presença e emissão de certificado.</span>
                    </p>
                  </form>
                </>
              )}
            </div>
          </motion.div>

          {/* Secondary card - certificado */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.6 }}
            className="relative mt-6 sm:mt-8 rounded-[28px] sm:rounded-[32px] border border-white/[0.07] bg-[rgba(23,23,25,0.55)] backdrop-blur-xl overflow-hidden shadow-[0_16px_48px_-16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="p-6 sm:p-8 md:p-10 min-w-0">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-lavender">
                  <Award className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-base sm:text-lg text-data tracking-wide">
                    Já participou do evento?
                  </h3>
                  <p className="mt-1 text-sm text-dim/70 leading-relaxed">
                    Após o evento, utilize seus dados para acessar seu certificado.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCertificado} noValidate className="mt-6 space-y-4 min-w-0 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0 w-full">
                  <div className="min-w-0">
                    <label htmlFor="certificate-cpf" className="block text-[11px] tracking-[0.16em] uppercase font-medium text-lavender/70 mb-2">CPF</label>
                    <input
                      id="certificate-cpf"
                      value={certForm.cpf}
                      onChange={(e) => setCertField("cpf", maskCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      aria-invalid={Boolean(certErrors.cpf)}
                      aria-describedby={certErrors.cpf ? "certificate-cpf-error" : undefined}
                      className={`${inputBase} ${certErrors.cpf ? inputErr : inputOk}`}
                    />
                    {certErrors.cpf && <p id="certificate-cpf-error" role="alert" className="mt-1.5 text-xs text-red-300">{certErrors.cpf}</p>}
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="certificate-birth-date" className="block text-[11px] tracking-[0.16em] uppercase font-medium text-lavender/70 mb-2">
                      Data de nascimento
                    </label>
                    <input
                      id="certificate-birth-date"
                      type="date"
                      value={certForm.nascimento}
                      onChange={(e) => setCertField("nascimento", e.target.value)}
                      aria-invalid={Boolean(certErrors.nascimento)}
                      aria-describedby={certErrors.nascimento ? "certificate-birth-date-error" : undefined}
                      className={`${inputBase} ${certErrors.nascimento ? inputErr : inputOk} [color-scheme:dark]`}
                    />
                    {certErrors.nascimento && <p id="certificate-birth-date-error" role="alert" className="mt-1.5 text-xs text-red-300">{certErrors.nascimento}</p>}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={certSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-md text-data text-sm font-medium tracking-[0.10em] uppercase hover:bg-white/[0.08] hover:border-white/25 hover:text-white transition-all disabled:opacity-60"
                >
                  {certSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                  {certSubmitting ? "Buscando certificado..." : "Acessar certificado"}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Small footer hint */}
          <p className="mt-8 text-center text-xs text-dim/35">
            Dúvidas? Fale com a organização pelo canal oficial do ENTEC.
          </p>
        </div>
      </main>

      <Footer />

      {/* Modal elegante para certificado ainda não liberado */}
      <AnimatePresence>
        {showCertModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-void/70 backdrop-blur-sm"
            onClick={() => setShowCertModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-[24px] border border-white/10 bg-gradient-to-b from-[rgba(36,36,38,0.95)] to-[rgba(16,16,18,0.98)] backdrop-blur-xl p-7 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.55)] overflow-hidden"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <button
                onClick={() => setShowCertModal(false)}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-dim/60 hover:text-data hover:border-white/20 transition"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-void mx-auto shadow-[0_8px_20px_rgba(255,255,255,0.15)]">
                <Award className="h-6 w-6" />
              </div>
              <h4 className="mt-4 text-center font-display font-semibold text-lg text-data">Certificados ainda não liberados</h4>
              <p className="mt-2 text-center text-sm leading-relaxed text-dim/75">
                Os certificados da ENTEC 2026 ainda não foram liberados pela organização. Após o encerramento do evento, volte a esta
                página para acessá-los.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowCertModal(false)}
                  className="px-7 py-2.5 rounded-full bg-data text-void text-sm font-semibold tracking-[0.08em] uppercase hover:bg-white transition-colors"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
