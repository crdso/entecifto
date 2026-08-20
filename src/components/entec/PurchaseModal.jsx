import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { insertRow } from "@/lib/supabase";
import { createPayment } from "@/lib/createPayment";
import { SUPABASE_CONFIGURED } from "@/lib/supabaseConfig";

const SIZES = ["PP", "P", "M", "G"];
const GENEROS = ["Masculino", "Feminino"];
const VALOR = "R$ 60,00";
const NOME_CAMISA_MAX = 20;

// E-mails elegíveis ao desconto de estudante (parte local antes do "@").
// R$ 10 de desconto -> R$ 50
const DISCOUNT_10_LOCAL_PARTS = [
  "abraao.lima2", "adrya.oliveira", "alexandre.fernandes2", "ana.rios2",
  "anna.lima5", "bianca.silva15", "brunno.oliveira4", "caio.moraes",
  "cassio.costa2", "claudio.cardoso", "danhyel.gomes", "daniele.santos2",
  "davi.pereira5", "denner.pontes", "eduarda.padilha", "eliaby.veloso",
  "ezequias.cardoso", "gabriel.sousa21", "gustavo.nascimento3", "hemilly.souza2",
  "hiago.sousa3", "jair.cavalcante", "jhonata.silva6", "juliana.lima3",
  "khalil.pellegrini", "laura.tundelo", "luis.santana", "luiz.fischer",
  "maria.lopes18", "maria.conceicao12", "matheus.gomes4", "rafysa.menezes",
  "sabrina.silva9", "thaylon.carvalho", "yuri.silva6",
];
// R$ 5 de desconto -> R$ 55
const DISCOUNT_5_LOCAL_PARTS = [
  "dallila.sousa", "pedro.oliveira28", "ana.macedo10", "thaylla.oliveira",
  "luiz.sousa16", "lorena.oliveira", "aguida.carvalho2", "maysa.viana",
  "rihana.santos",
];
const VALOR_DESCONTO_10 = "R$ 50,00";
const VALOR_DESCONTO_5 = "R$ 55,00";

function maskPhone(v) {
  let d = String(v || "").replace(/\D/g, "").slice(0, 11);
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 0) return `(${d}`;
  return "";
}

function validate(form) {
  const errs = {};
  if ((form.nome || "").trim().length < 3) errs.nome = "Informe seu nome completo.";
  const nomeCamisa = (form.nome_camisa || "").trim();
  if (nomeCamisa && nomeCamisa.length > NOME_CAMISA_MAX)
    errs.nome_camisa = `Máximo de ${NOME_CAMISA_MAX} caracteres.`;
  if (nomeCamisa && /[^A-Za-zÀ-ÿ0-9 .-]/.test(nomeCamisa))
    errs.nome_camisa = "Use apenas letras, números, espaços, pontos e hífens.";
  const digits = String(form.telefone || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) errs.telefone = "Telefone inválido.";
  if (!/^[^\s@]+@estudante\.ifto\.edu\.br$/i.test((form.email || "").trim()))
    errs.email = "Use seu e-mail institucional (@estudante.ifto.edu.br).";
  if (!SIZES.includes(form.tamanho)) errs.tamanho = "Selecione um tamanho.";
  if (!GENEROS.includes(form.genero)) errs.genero = "Selecione uma opção.";
  return errs;
}

export default function PurchaseModal({ open, onClose }) {
  const [form, setForm] = useState({ nome: "", nome_camisa: "", genero: "", telefone: "", email: "", tamanho: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  // Reset ao (re)abrir
  useEffect(() => {
    if (open) {
      setForm({ nome: "", nome_camisa: "", genero: "", telefone: "", email: "", tamanho: "" });
      setErrors({});
      setServerError("");
      setSuccess(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const emailLocal = form.email.trim().toLowerCase().split("@")[0];
  const hasDiscount =
    DISCOUNT_10_LOCAL_PARTS.includes(emailLocal) ||
    DISCOUNT_5_LOCAL_PARTS.includes(emailLocal);
  const valor = DISCOUNT_10_LOCAL_PARTS.includes(emailLocal)
    ? 50
    : DISCOUNT_5_LOCAL_PARTS.includes(emailLocal)
      ? 55
      : 60;
  const priceText =
    valor === 50 ? VALOR_DESCONTO_10 : valor === 55 ? VALOR_DESCONTO_5 : VALOR;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (!SUPABASE_CONFIGURED) {
      setServerError("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) Salva a inscrição no Supabase com status pendente
      //    (id gerado aqui para não depender do retorno da API)
      const inscricao = await insertRow("inscricoes", {
        id: crypto.randomUUID(),
        nome: form.nome.trim(),
        nome_camisa: form.nome_camisa.trim() || null,
        genero: form.genero,
        telefone: form.telefone,
        email: form.email.trim(),
        tamanho: form.tamanho,
        status: "pending_payment",
        valor,
        payment_id: null,
        payment_status: null,
        payment_method: null,
        paid_at: null,
      });

      // 2) Cria a preferência no Mercado Pago e redireciona para o checkout
      const result = await createPayment(inscricao);
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      setSuccess(true);
    } catch (err) {
      setServerError(err.message || "Ocorreu um erro ao salvar sua inscrição.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl bg-void/60 border border-signal/20 px-4 py-2.5 text-sm text-data placeholder-dim/40 outline-none focus:border-signal/60 transition-colors";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-void/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-signal/25 bg-gradient-to-b from-energy/40 to-void p-5 sm:p-6 shadow-[0_30px_80px_-20px_rgba(36,107,253,0.45)]"
          >
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-full border border-signal/20 text-dim/70 hover:text-data hover:border-signal/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {success ? (
              <div className="text-center py-5">
                <CheckCircle2 className="h-12 w-12 text-lavender mx-auto" />
                <h3 className="mt-4 font-display font-bold text-xl text-data">
                  Inscrição registrada!
                </h3>
                <p className="mt-2 text-sm text-dim/70 max-w-sm mx-auto">
                  Sua inscrição foi salva com status de <strong>pagamento pendente</strong>.
                </p>
                <button
                  onClick={onClose}
                  className="mt-5 px-6 py-2.5 rounded-full bg-signal text-data font-semibold shadow-[0_0_24px_rgba(36,107,253,0.4)] transition-transform hover:scale-[1.03]"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <>
                <div className="pr-6">
                  <span className="inline-block mb-2.5 px-3 py-1 rounded-full bg-signal/10 border border-signal/30 text-lavender text-[10px] font-medium tracking-[0.18em] uppercase">
                    Camisa Oficial
                  </span>
                  <h3 className="font-display font-bold text-xl sm:text-2xl text-data">
                    Adquira a sua ENTEC 2026
                  </h3>
                  <p className="mt-1.5 text-xs text-dim/70">
                    Preencha seus dados para continuar o pagamento via Mercado Pago.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-dim/70 mb-1.5">Nome completo</label>
                    <input
                      className={inputClass}
                      value={form.nome}
                      onChange={(e) => setField("nome", e.target.value)}
                      placeholder="Seu nome completo"
                    />
                    {errors.nome && <p className="mt-1 text-xs text-red-400">{errors.nome}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-dim/70 mb-1.5">
                      Nome na camisa (opcional)
                    </label>
                    <input
                      className={inputClass}
                      value={form.nome_camisa}
                      onChange={(e) => setField("nome_camisa", e.target.value)}
                      placeholder="Ex.: João, Jhow, JP…"
                      maxLength={NOME_CAMISA_MAX}
                    />
                    <p className="mt-1 text-[11px] leading-relaxed text-dim/50">
                      Caso este campo seja deixado em branco, será utilizado o primeiro nome
                      informado. Nomes considerados ofensivos ou inadequados serão substituídos
                      pelo primeiro nome do comprador.
                    </p>
                    {errors.nome_camisa && (
                      <p className="mt-1 text-xs text-red-400">{errors.nome_camisa}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-dim/70 mb-1.5">Telefone</label>
                    <input
                      className={inputClass}
                      value={form.telefone}
                      onChange={(e) => setField("telefone", maskPhone(e.target.value))}
                      placeholder="(63) 99999-9999"
                      inputMode="tel"
                    />
                    {errors.telefone && <p className="mt-1 text-xs text-red-400">{errors.telefone}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-dim/70 mb-1.5">E-mail institucional</label>
                    <input
                      className={inputClass}
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      placeholder="voce@estudante.ifto.edu.br"
                      inputMode="email"
                    />
                    {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-dim/70 mb-1.5">Tamanho</label>
                    <div className="grid grid-cols-4 gap-2">
                      {SIZES.map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => setField("tamanho", s)}
                          className={`py-2 rounded-xl border text-sm font-medium transition-all ${
                            form.tamanho === s
                              ? "border-signal bg-signal/20 text-data"
                              : "border-signal/20 text-dim/70 hover:border-signal/50 hover:text-data"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {errors.tamanho && <p className="mt-1 text-xs text-red-400">{errors.tamanho}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-dim/70 mb-1.5">Gênero</label>
                    <div className="grid grid-cols-2 gap-2">
                      {GENEROS.map((g) => (
                        <button
                          type="button"
                          key={g}
                          onClick={() => setField("genero", g)}
                          className={`py-1.5 rounded-xl border text-sm font-medium transition-all ${
                            form.genero === g
                              ? "border-signal bg-signal/20 text-data"
                              : "border-signal/20 text-dim/70 hover:border-signal/50 hover:text-data"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    {errors.genero && <p className="mt-1 text-xs text-red-400">{errors.genero}</p>}
                  </div>

                  {serverError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      {serverError}
                    </div>
                  )}

                  {hasDiscount && (
                    <p className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1 text-center text-[11px] font-medium text-emerald-300">
                      Desconto para estudante
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-data font-semibold text-base">{priceText}</span>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="group inline-flex items-center gap-2 px-6 py-3 rounded-full bg-signal text-data font-semibold shadow-[0_0_24px_rgba(36,107,253,0.4)] disabled:opacity-60 transition-transform hover:scale-[1.03]"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          Ir para pagamento
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>
                  </div>
                  <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-dim/40">
                    <ExternalLink className="h-3 w-3" />
                    Você será redirecionado para o pagamento seguro do Mercado Pago.
                  </p>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
