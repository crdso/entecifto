import React, { useState, useEffect, useMemo } from "react";
import { Search, Loader2, ShieldCheck, LogOut, PackageCheck, Package, Copy, CopyCheck, Eye, Activity, Users, Globe, RefreshCw, Trash2, Download, FileDown, UserCheck, BadgeCheck, CheckCircle2, X, AlertCircle, Wallet, QrCode, Trophy } from "lucide-react";
import moment from "moment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectRows, supabase, updateRow, deleteRow } from "@/lib/supabase";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseConfig";
import CheckinScanner from "@/components/admin/CheckinScanner";
import ResultsAdmin from "@/components/admin/ResultsAdmin";
import jsPDF from "jspdf";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase();

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "pending_payment", label: "Pendente" },
  { key: "pago", label: "Pago" },
];

const STATUS_BADGE = {
  pago: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  pending_payment: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};
const STATUS_LABEL = {
  pago: "Pago",
  pending_payment: "Pendente",
};

// Nome que vai estampado na camisa: usa o escolhido ou cai para o primeiro nome.
const shirtName = (r) => {
  const escolhido = (r.nome_camisa || "").trim();
  if (escolhido) return escolhido;
  return (r.nome || "").trim().split(/\s+/)[0] || "—";
};

// Taxas MP conforme tabela do usuário — para bater exato com R$ 393,81
function getFeeInfo(valor, method) {
  const v = Number(valor) || 0;
  const m = (method || "").toLowerCase();
  let taxa = 0;
  let label = "";
  if (m === "pix") { taxa = v * 0.0099; label = "0,99% Pix"; }
  else if (m === "account_money") { taxa = v * 0.0499; label = "4,99% conta"; }
  else if (m.includes("ticket") || m.includes("bol")) { taxa = 3.49; label = "R$ 3,49 Boleto"; }
  else if (m.includes("debit")) { taxa = v * 0.0399; label = "3,99% Débito"; }
  else if (m.includes("credit")) { taxa = v * 0.0499; label = "4,99% Crédito"; }
  else { taxa = v * 0.0099; label = "0,99%"; }
  const taxaR = Number(taxa.toFixed(2));
  const liquido = Number((v - taxaR).toFixed(2));
  return { taxa: taxaR, liquido, label };
}

export default function Admin() {
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [adminTab, setAdminTab] = useState("inscricoes");
  const [visitas, setVisitas] = useState([]);
  const [visitasLoading, setVisitasLoading] = useState(false);
  const [visitasError, setVisitasError] = useState("");
  const [participantes, setParticipantes] = useState([]);
  const [participantesLoading, setParticipantesLoading] = useState(false);
  const [participantesError, setParticipantesError] = useState("");
  const [participantesSearch, setParticipantesSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [bulkResult, setBulkResult] = useState("");

  const isAllowed = (user) => {
    if (!ADMIN_EMAIL) return false;
    return (user?.email || "").trim().toLowerCase() === ADMIN_EMAIL;
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      if (!supabase) {
        setError("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar o painel administrativo.");
        setAuthLoading(false);
        return;
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!isMounted) return;
      let finalSession = currentSession;
      if (finalSession && !isAllowed(finalSession.user)) {
        if (!ADMIN_EMAIL) {
          setError("Painel administrativo não configurado.");
        } else {
          setError("Acesso restrito. Esta conta não tem permissão para o painel administrativo.");
        }
        await supabase.auth.signOut();
        finalSession = null;
      }
      setSession(finalSession);
      setAuthLoading(false);
    };

    initializeAuth();

    const { data: { subscription } } = supabase
      ? supabase.auth.onAuthStateChange(async (_event, currentSession) => {
          if (!isMounted) return;
          if (currentSession && !isAllowed(currentSession.user)) {
            if (!ADMIN_EMAIL) {
              setError("Painel administrativo não configurado.");
            } else {
              setError("Acesso restrito. Esta conta não tem permissão para o painel administrativo.");
            }
            await supabase.auth.signOut();
            setSession(null);
          } else {
            setSession(currentSession);
            setError("");
          }
          setAuthLoading(false);
        })
      : { data: { subscription: null } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await selectRows("inscricoes", "order=created_at.desc&limit=1000", session?.access_token);
      setRows(data || []);
    } catch (e) {
      setError(e.message || "Falha ao carregar inscrições.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVisitas = async () => {
    if (!session?.access_token) return;
    setVisitasLoading(true);
    setVisitasError("");
    try {
      const data = await selectRows("visitas", "order=created_at.desc&limit=200", session.access_token);
      setVisitas(data || []);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("visitas") || msg.includes("42P01") || msg.includes("404")) {
        setVisitasError("Tabela visitas ainda não criada. Rode o schema.sql no SQL Editor do Supabase.");
      } else {
        setVisitasError(msg || "Falha ao carregar visitas.");
      }
      setVisitas([]);
    } finally {
      setVisitasLoading(false);
    }
  };

  const loadParticipantes = async () => {
    if (!session?.access_token) return;
    setParticipantesLoading(true);
    setParticipantesError("");
    try {
      const data = await selectRows(
        "event_registrations",
        "select=id,name,email,cpf_last4,created_at,attendance_confirmed,attendance_confirmed_at,attendance_confirmed_by,wallet_status,wallet_created_at,certificate_ready&order=created_at.desc&limit=1000",
        session.access_token
      );
      setParticipantes(data || []);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("event_registrations") || msg.includes("42P01") || msg.includes("404")) {
        setParticipantesError("Tabela event_registrations ainda não criada. Rode supabase/event_registrations.sql no SQL Editor do Supabase.");
      } else {
        setParticipantesError(msg || "Falha ao carregar participantes.");
      }
      setParticipantes([]);
    } finally {
      setParticipantesLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      load();
      loadVisitas();
      loadParticipantes();
    } else {
      setRows([]);
      setVisitas([]);
      setParticipantes([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Realtime para visitas quando a aba estiver aberta
  useEffect(() => {
    if (!session || !supabase || adminTab !== "visitas") return;
    const channel = supabase
      .channel("visitas-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "visitas" }, (payload) => {
        setVisitas((prev) => [payload.new, ...prev].slice(0, 200));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, adminTab]);

  // Realtime para participantes — só colunas seguras atravessam a rede
  useEffect(() => {
    if (!session || !supabase || adminTab !== "participantes") return;
    const channel = supabase
      .channel("event-registrations-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "event_registrations",
          select: [
            "id",
            "attendance_confirmed",
            "attendance_confirmed_at",
            "attendance_confirmed_by",
            "wallet_status",
            "wallet_created_at",
            "certificate_ready",
            "updated_at",
          ],
        },
        (payload) => {
          const updated = payload.new;
          if (!updated || !updated.id) return;
          const safe = {
            attendance_confirmed: updated.attendance_confirmed,
            attendance_confirmed_at: updated.attendance_confirmed_at,
            attendance_confirmed_by: updated.attendance_confirmed_by,
            wallet_status: updated.wallet_status,
            wallet_created_at: updated.wallet_created_at,
            certificate_ready: updated.certificate_ready,
            updated_at: updated.updated_at,
          };
          setParticipantes((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...safe } : p)));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, adminTab]);

  const indicators = useMemo(() => {
    const total = rows.length;
    const pagos = rows.filter((r) => r.status === "pago");
    const pendentes = rows.filter((r) => r.status === "pending_payment");
    const entregues = rows.filter((r) => r.delivered);
    const arrecadado = pagos.reduce((s, r) => s + Number(r.valor || 0), 0);
    return {
      total,
      pagos: pagos.length,
      pendentes: pendentes.length,
      entregues: entregues.length,
      arrecadado: arrecadado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    };
  }, [rows]);

  const visitasStats = useMemo(() => {
    const now = Date.now();
    const hoje = visitas.filter((v) => {
      const d = new Date(v.created_at);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length;
    const online = visitas.filter((v) => now - new Date(v.created_at).getTime() < 5 * 60 * 1000).length;
    const unicos = new Set(visitas.map((v) => v.ip).filter(Boolean)).size;
    return { total: visitas.length, hoje, online, unicos };
  }, [visitas]);

  const participantesStats = useMemo(() => {
    const total = participantes.length;
    const confirmados = participantes.filter((p) => p.attendance_confirmed).length;
    const pendentes = total - confirmados;
    return { total, confirmados, pendentes };
  }, [participantes]);

  const filteredParticipantes = useMemo(() => {
    const q = participantesSearch.trim().toLowerCase();
    if (!q) return participantes;
    return participantes.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q));
  }, [participantes, participantesSearch]);

  const financeiro = useMemo(() => {
    const pagos = rows.filter((r) => r.status === "pago");
    let bruto = 0;
    let taxas = 0;
    let liquido = 0;
    pagos.forEach((r) => {
      const { taxa, liquido: liq } = getFeeInfo(r.valor, r.payment_method);
      bruto += Number(r.valor) || 0;
      taxas += taxa;
      liquido += liq;
    });
    const rendimentos = 0.14; // do extrato MP (21/08 0,04 + 20/08 0,05 + 19/08 0,05)
    const saldoConta = Number((liquido + rendimentos).toFixed(2));
    return {
      bruto: Number(bruto.toFixed(2)),
      taxas: Number(taxas.toFixed(2)),
      liquido: Number(liquido.toFixed(2)),
      rendimentos,
      saldoConta,
      qtd: pagos.length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const okStatus = filter === "todos" || r.status === filter;
      const okSearch =
        !q ||
        (r.nome || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q);
      return okStatus && okSearch;
    });
  }, [rows, filter, search]);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!supabase) {
      setError("Configure as variáveis de ambiente do Supabase para acessar o painel.");
      return;
    }

    setAuthSubmitting(true);
    setError("");

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message || "Falha ao entrar.");
    } else if (!isAllowed(data.user)) {
      if (!ADMIN_EMAIL) {
        setError("Painel administrativo não configurado.");
      } else {
        setError("Acesso restrito. Esta conta não tem permissão para o painel administrativo.");
      }
      await supabase.auth.signOut();
    } else {
      setSession(data.session);
      setPassword("");
    }

    setAuthSubmitting(false);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setPassword("");
    setError("");
  };

  const copyRow = async (r, mode) => {
    const lines =
      mode === "mini"
        ? [`apelido camisa: ${shirtName(r)}`, `tamanho: ${r.tamanho}`]
        : [
            `nome da pessoa: ${r.nome}`,
            `apelido camisa: ${shirtName(r)}`,
            `tamanho: ${r.tamanho}`,
            `telefone: ${r.telefone}`,
          ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedId(`${r.id}:${mode}`);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError("Não foi possível copiar.");
    }
  };

  const markDelivered = async (r) => {
    if (!session) return;
    setUpdatingId(r.id);
    setError("");
    try {
      await updateRow("inscricoes", `id=eq.${r.id}`, { delivered: true }, session.access_token);
      await load();
    } catch (e) {
      setError(e.message || "Falha ao marcar como entregue.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (r) => {
    if (!session) return;
    const ok = window.confirm(`Deletar a inscrição de "${r.nome}" (${r.email})?\nEsta ação não pode ser desfeita.`);
    if (!ok) return;
    setUpdatingId(r.id);
    setError("");
    try {
      await deleteRow("inscricoes", `id=eq.${r.id}`, session.access_token);
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      setError(e.message || "Falha ao deletar.");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleAttendance = async (p) => {
    if (!session?.access_token) return;
    setUpdatingId(p.id);
    setError("");
    try {
      const action = !p.attendance_confirmed ? "manual_confirm" : "manual_remove";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action, registration_id: p.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Falha ao atualizar presença (${res.status})`);
      const participant = data.participant || {};
      setParticipantes((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? {
                ...x,
                attendance_confirmed: participant.attendance_confirmed ?? (action === "manual_confirm"),
                attendance_confirmed_at: participant.attendance_confirmed_at ?? null,
                attendance_confirmed_by: participant.attendance_confirmed_by ?? null,
              }
            : x
        )
      );
    } catch (e) {
      setError(e.message || "Falha ao atualizar presença.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteParticipante = async (p) => {
    if (!session?.access_token) return;
    const ok = window.confirm(`Remover participante "${p.name}" (${p.email})?\nEsta ação não pode ser desfeita.`);
    if (!ok) return;
    setUpdatingId(p.id);
    setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "manual_delete", registration_id: p.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Falha ao remover participante (${res.status})`);
      setParticipantes((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e.message || "Falha ao remover participante.");
    } finally {
      setUpdatingId(null);
    }
  };

  const retryWallet = async (p) => {
    if (!session?.access_token) return;
    setUpdatingId(p.id);
    setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ registration_id: p.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Falha ao gerar credencial (${res.status})`);
      await loadParticipantes();
    } catch (e) {
      setError(e.message || "Falha ao tentar gerar novamente.");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleCertificate = async (p) => {
    if (!session?.access_token) return;
    setUpdatingId(p.id);
    setError("");
    try {
      const enabled = !p.certificate_ready;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-certificate-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ registration_id: p.id, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Falha ao ${enabled ? "liberar" : "remover"} certificado (${res.status})`);
      setParticipantes((prev) => prev.map((x) => (x.id === p.id ? { ...x, certificate_ready: enabled } : x)));
    } catch (e) {
      setError(e.message || "Falha ao atualizar certificado.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Ação em massa: confirma presença de todos os pendentes e libera
  // certificado de todos os não liberados, reaproveitando os endpoints
  // individuais já em produção (event-checkin + event-certificate-admin).
  const confirmAllAndReleaseCertificates = async () => {
    if (!session?.access_token || bulkRunning) return;
    const pendentesPresenca = participantes.filter((p) => !p.attendance_confirmed);
    const pendentesCert = participantes.filter((p) => !p.certificate_ready);
    const total = pendentesPresenca.length + pendentesCert.length;
    if (total === 0) {
      setBulkResult("Tudo certo: todos já têm presença confirmada e certificado liberado.");
      return;
    }
    const ok = window.confirm(
      `Confirmar presença de ${pendentesPresenca.length} participante(s) e liberar certificado de ${pendentesCert.length}?\nTotal de ${total} atualizações.\nDá para desfazer individualmente depois, se precisar.`
    );
    if (!ok) return;
    setBulkRunning(true);
    setBulkResult("");
    setError("");
    setBulkProgress({ done: 0, total });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    };
    const failures = [];
    let done = 0;
    const runPool = async (items, task) => {
      const CONCURRENCY = 4;
      let i = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, Math.max(items.length, 1)) }, async () => {
        while (i < items.length) {
          const item = items[i];
          i += 1;
          try {
            await task(item);
          } catch (e) {
            failures.push(`${item.name || item.email || item.id}: ${e.message || "erro"}`);
          }
          done += 1;
          setBulkProgress({ done, total });
        }
      });
      await Promise.all(workers);
    };
    const confirmTask = async (p) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-checkin`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "manual_confirm", registration_id: p.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    };
    const certTask = async (p) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/event-certificate-admin`, {
        method: "POST",
        headers,
        body: JSON.stringify({ registration_id: p.id, enabled: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    };
    try {
      await runPool(pendentesPresenca, confirmTask);
      await runPool(pendentesCert, certTask);
      await loadParticipantes();
      setBulkResult(
        failures.length === 0
          ? `Concluído: ${pendentesPresenca.length} presença(s) confirmada(s) e ${pendentesCert.length} certificado(s) liberado(s).`
          : `Concluído com ${failures.length} falha(s): ${failures.slice(0, 5).join(" • ")}${failures.length > 5 ? "…" : ""}`
      );
    } catch (e) {
      setError(e.message || "Falha na ação em massa.");
    } finally {
      setBulkRunning(false);
      setBulkProgress(null);
    }
  };

  const exportParticipantesCSV = () => {
    const list = filteredParticipantes;
    if (!list.length) {
      setError("Nenhum participante para exportar.");
      return;
    }
    const header = ["nome", "email", "cpf_last4", "attendance_confirmed", "created_at"];
    const rowsCsv = list.map((p) => [
      `"${String(p.name || "").replace(/"/g, '""')}"`,
      `"${String(p.email || "").replace(/"/g, '""')}"`,
      p.cpf_last4 || "",
      p.attendance_confirmed ? "true" : "false",
      p.created_at ? new Date(p.created_at).toISOString() : "",
    ].join(","));
    const csv = [header.join(","), ...rowsCsv].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entec2026-participantes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = (tipo) => {
    const list = filtered.length ? filtered : rows;
    if (!list.length) {
      setError("Nenhum dado para exportar.");
      return;
    }
    const isResumido = tipo === "resumido";
    const doc = new jsPDF();
    const title = isResumido ? "ENTEC 2026 — Lista Resumida" : "ENTEC 2026 — Lista Completa";
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 18);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const filtroTxt = filter === "todos" ? "Todos" : filter === "pago" ? "Pagos" : "Pendentes";
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} • ${list.length} pedidos • Filtro: ${filtroTxt}${search ? ` • Busca: "${search}"` : ""}`,
      14,
      24
    );
    if (!isResumido) {
      const f = financeiro;
      doc.text(
        `Bruto ${f.bruto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} • Taxas ${f.taxas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} • Líquido ${f.liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} • Saldo ${f.saldoConta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} • Rend. ${f.rendimentos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        14,
        30
      );
    }
    let y = isResumido ? 32 : 36;
    const pageH = doc.internal.pageSize.getHeight();
    list.forEach((r, idx) => {
      if (y > pageH - 22) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30);
      doc.text(`${idx + 1}. ${r.nome}`, 14, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(60);
      const lines = isResumido
        ? [
            `nome: ${r.nome}`,
            `nome camisa: ${shirtName(r)}`,
            `genero: ${r.genero || "—"}`,
            `tamanho: ${r.tamanho}`,
          ]
        : [
            `nome: ${r.nome}`,
            `nome camisa: ${shirtName(r)}`,
            `genero: ${r.genero || "—"}`,
            `tamanho: ${r.tamanho}`,
            `telefone: ${r.telefone}`,
            `email: ${r.email}`,
            `valor: ${Number(r.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} • pagamento: ${r.payment_method ? (r.payment_method === "pix" ? "Pix" : r.payment_method === "account_money" ? "Conta MP" : r.payment_method) : "—"} • status: ${STATUS_LABEL[r.status] || r.status} • liquido: ${r.status === "pago" ? getFeeInfo(r.valor, r.payment_method).liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}`,
            `data: ${r.created_at ? moment(r.created_at).format("DD/MM/YYYY HH:mm") : "—"}`,
          ];
      lines.forEach((l) => {
        const split = doc.splitTextToSize(`- ${l}`, 182);
        split.forEach((s) => {
          if (y > pageH - 12) {
            doc.addPage();
            y = 14;
          }
          doc.text(s, 16, y);
          y += 4.5;
        });
      });
      y += 2;
      doc.setDrawColor(220);
      doc.line(14, y, 196, y);
      y += 6;
    });
    const suffix = isResumido ? "resumido" : "completo";
    doc.save(`entec2026-${suffix}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-data">
        <Loader2 className="h-6 w-6 animate-spin text-lavender" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-signal/25 bg-void/70 bg-gradient-to-b from-energy/40 to-void p-8 shadow-[0_30px_80px_-20px_rgba(36,107,253,0.45)] backdrop-blur-md">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="h-6 w-6 text-lavender" />
            <h1 className="font-display text-xl font-bold text-data">Painel administrativo</h1>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-dim/70 text-xs font-medium">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@exemplo.com"
                className="bg-void/60 border-signal/20 text-data placeholder:text-dim/40"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-dim/70 text-xs font-medium">Senha</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="bg-void/60 border-signal/20 text-data placeholder:text-dim/40"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-signal text-data hover:bg-signal/90" disabled={authSubmitting}>
              {authSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Total de inscrições", value: indicators.total },
    { label: "Pagamentos aprovados", value: indicators.pagos },
    { label: "Pagamentos pendentes", value: indicators.pendentes },
    { label: "Camisas entregues", value: indicators.entregues },
  ];

  return (
    <div className="min-h-screen text-data">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-lavender" />
            <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">
              Painel Administrativo
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-emerald-500/30 text-data hover:bg-emerald-500/10">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-void border-signal/20 text-data">
                <DropdownMenuLabel>Exportar lista (PDF)</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-signal/15" />
                <DropdownMenuItem
                  onClick={() => handleDownload("completo")}
                  className="gap-2 focus:bg-signal/10 focus:text-data cursor-pointer"
                >
                  <FileDown className="h-4 w-4" />
                  PDF Completo (todos os dados)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDownload("resumido")}
                  className="gap-2 focus:bg-signal/10 focus:text-data cursor-pointer"
                >
                  <FileDown className="h-4 w-4" />
                  PDF Resumido — nome, camisa, gênero, tamanho
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 border-signal/20 text-data">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setAdminTab("inscricoes")}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${adminTab === "inscricoes" ? "border-signal bg-signal/20 text-data" : "border-signal/20 text-dim/70 hover:border-signal/50 hover:text-data"}`}
          >
            Inscrições
          </button>
          <button
            onClick={() => { setAdminTab("participantes"); loadParticipantes(); }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${adminTab === "participantes" ? "border-signal bg-signal/20 text-data" : "border-signal/20 text-dim/70 hover:border-signal/50 hover:text-data"}`}
          >
            <Users className="h-4 w-4" />
            Participantes {participantesStats.total > 0 && <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs">{participantesStats.total}</span>}
          </button>
          <button
            onClick={() => { setAdminTab("visitas"); loadVisitas(); }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${adminTab === "visitas" ? "border-signal bg-signal/20 text-data" : "border-signal/20 text-dim/70 hover:border-signal/50 hover:text-data"}`}
          >
            <Eye className="h-4 w-4" />
            Acessos {visitasStats.online > 0 && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
          </button>
          <button
            onClick={() => setAdminTab("resultados")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${adminTab === "resultados" ? "border-signal bg-signal/20 text-data" : "border-signal/20 text-dim/70 hover:border-signal/50 hover:text-data"}`}
          >
            <Trophy className="h-4 w-4" />
            Resultados
          </button>
        </div>

        {adminTab === "inscricoes" ? (
          <>
            {/* Indicadores */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-md px-5 py-4"
            >
              <div className="text-[11px] uppercase tracking-[0.16em] text-lavender/70 font-medium">
                {c.label}
              </div>
              <div className="mt-1 text-2xl font-semibold text-data">{c.value}</div>
            </div>
          ))}
        </div>

            {/* Financeiro — bate exato com extrato */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 mb-6">
              <h3 className="text-[11px] uppercase tracking-[0.16em] text-emerald-300/80 font-medium mb-3">
                Financeiro — bate com R$ 393,81 em conta
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <div className="text-[11px] text-dim/60">Bruto (7 pagos)</div>
                  <div className="text-lg font-semibold text-data">
                    {financeiro.bruto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-dim/60">Taxas MP</div>
                  <div className="text-lg font-semibold text-amber-300">
                    - {financeiro.taxas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-dim/60">Líquido vendas</div>
                  <div className="text-lg font-semibold text-emerald-300">
                    {financeiro.liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-dim/60">Rendimentos</div>
                  <div className="text-lg font-semibold text-data">
                    + {financeiro.rendimentos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2">
                  <div className="text-[11px] text-emerald-300/70">Saldo em conta</div>
                  <div className="text-lg font-bold text-emerald-300">
                    {financeiro.saldoConta.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-dim/40">
                Pix 0,99% · Conta 4,99% — cada linha mostra bruto, meio e líquido já descontado. 7 pagos: 3× R$60 + 4× R$55 (descontos) = R$400 bruto.
              </p>
            </div>

        {/* Controles */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  filter === f.key
                    ? "border-signal bg-signal/20 text-data"
                    : "border-signal/20 text-dim/70 hover:border-signal/50 hover:text-data"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dim/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="w-full rounded-full bg-void/60 border border-signal/20 pl-10 pr-4 py-2 text-sm outline-none focus:border-signal/60"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Tabela */}
        <div className="rounded-2xl border border-signal/20 bg-void/40 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-lavender" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-dim/50 text-sm">
              Nenhuma inscrição encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-lavender/70 border-b border-signal/15">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Nome camisa</th>
                    <th className="px-4 py-3 font-medium">Telefone</th>
                    <th className="px-4 py-3 font-medium">E-mail</th>
                    <th className="px-4 py-3 font-medium">Tam.</th>
                    <th className="px-4 py-3 font-medium">Gênero</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Pagto</th>
                    <th className="px-4 py-3 font-medium">Líquido</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Entrega</th>
                    <th className="px-4 py-3 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-signal/10 hover:bg-signal/5">
                      <td className="px-4 py-3 font-medium text-data">{r.nome}</td>
                      <td className="px-4 py-3 text-dim/80">{shirtName(r)}</td>
                      <td className="px-4 py-3 text-dim/80">{r.telefone}</td>
                      <td className="px-4 py-3 text-dim/80">{r.email}</td>
                      <td className="px-4 py-3 text-dim/80">{r.tamanho}</td>
                      <td className="px-4 py-3 text-dim/80">{r.genero || "—"}</td>
                      <td className="px-4 py-3 text-data font-medium whitespace-nowrap">
                        {Number(r.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-4 py-3 text-dim/70 text-xs whitespace-nowrap" title={r.payment_method || ""}>
                        {r.status === "pago"
                          ? r.payment_method === "pix"
                            ? "Pix"
                            : r.payment_method === "account_money"
                              ? "Conta MP"
                              : r.payment_method || "—"
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-emerald-300 text-xs whitespace-nowrap">
                        {r.status === "pago" ? getFeeInfo(r.valor, r.payment_method).liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-dim/60">
                        {r.created_at ? moment(r.created_at).format("DD/MM/YYYY HH:mm") : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-1 text-xs ${
                            STATUS_BADGE[r.status] || "border-signal/20 text-dim/70"
                          }`}
                        >
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.delivered ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                            <PackageCheck className="h-3.5 w-3.5" />
                            Entregue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/20 px-2.5 py-1 text-xs text-dim/60">
                            <Package className="h-3.5 w-3.5" />
                            Não entregue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1.5">
                          {r.status === "pago" && !r.delivered && (
                            <button
                              onClick={() => markDelivered(r)}
                              disabled={updatingId === r.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/10 px-3 py-1.5 text-xs font-medium text-data transition-all hover:bg-signal/20 disabled:opacity-50"
                            >
                              {updatingId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PackageCheck className="h-3.5 w-3.5" />
                              )}
                              Marcar como entregue
                            </button>
                          )}
                          {r.delivered && <span className="text-xs text-dim/40">—</span>}
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => copyRow(r, "full")}
                              className="inline-flex items-center gap-1.5 rounded-full border border-pulse/30 bg-pulse/10 px-3 py-1.5 text-xs font-medium text-data transition-all hover:bg-pulse/20"
                            >
                              {copiedId === `${r.id}:full` ? (
                                <CopyCheck className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {copiedId === `${r.id}:full` ? "Copiado" : "Copiar"}
                            </button>
                            <button
                              onClick={() => copyRow(r, "mini")}
                              className="inline-flex items-center gap-1.5 rounded-full border border-pulse/30 bg-pulse/10 px-3 py-1.5 text-xs font-medium text-data transition-all hover:bg-pulse/20"
                            >
                              {copiedId === `${r.id}:mini` ? (
                                <CopyCheck className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              {copiedId === `${r.id}:mini` ? "Copiado" : "Copiar 2"}
                            </button>
                            <button
                              onClick={() => handleDelete(r)}
                              disabled={updatingId === r.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-all hover:bg-red-500/20 disabled:opacity-50"
                              title="Deletar inscrição"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Deletar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
          </>
        ) : adminTab === "participantes" ? (
          <>
            {/* Participantes — event_registrations */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-md px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-lavender/70 font-medium flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> Total de inscritos
                </div>
                <div className="mt-1 text-2xl font-semibold text-data">{participantesStats.total}</div>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-300/80 font-medium flex items-center gap-1.5">
                  <BadgeCheck className="h-3 w-3" /> Presenças confirmadas
                </div>
                <div className="mt-1 text-2xl font-semibold text-emerald-300">{participantesStats.confirmados}</div>
              </div>
              <div className="rounded-2xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-md px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-lavender/70 font-medium">Pendentes</div>
                <div className="mt-1 text-2xl font-semibold text-data">{participantesStats.pendentes}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <Button
                onClick={() => setScannerOpen(true)}
                className="w-full sm:w-auto gap-2 bg-white text-void hover:bg-white/90 font-bold text-sm px-6 py-3.5 sm:py-2.5 rounded-full shadow-[0_8px_24px_rgba(255,255,255,0.15)] hover:shadow-[0_8px_32px_rgba(255,255,255,0.25)] transition-all text-base sm:text-sm"
              >
                <QrCode className="h-5 w-5 sm:h-4 sm:w-4" />
                Escanear QR
              </Button>
              <Button
                onClick={confirmAllAndReleaseCertificates}
                disabled={bulkRunning || participantesLoading || participantes.length === 0}
                className="w-full sm:w-auto gap-2 bg-emerald-500 text-void hover:bg-emerald-400 font-bold text-sm px-6 py-3.5 sm:py-2.5 rounded-full shadow-[0_8px_24px_rgba(16,185,129,0.25)] transition-all text-base sm:text-sm disabled:opacity-50"
                title="Confirma a presença de todos os pendentes e libera o certificado de todos"
              >
                {bulkRunning ? (
                  <Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <BadgeCheck className="h-5 w-5 sm:h-4 sm:w-4" />
                )}
                {bulkRunning && bulkProgress
                  ? `Processando ${bulkProgress.done}/${bulkProgress.total}…`
                  : "Presença + certificado (todos)"}
              </Button>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative sm:w-72 flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dim/50" />
                  <input
                    value={participantesSearch}
                    onChange={(e) => setParticipantesSearch(e.target.value)}
                    placeholder="Buscar por nome ou e-mail"
                    className="w-full rounded-full bg-void/60 border border-signal/20 pl-10 pr-4 py-2 text-sm outline-none focus:border-signal/60"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={loadParticipantes} disabled={participantesLoading} className="gap-2 border-signal/20 text-data">
                    <RefreshCw className={`h-4 w-4 ${participantesLoading ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportParticipantesCSV} className="gap-2 border-emerald-500/30 text-data hover:bg-emerald-500/10">
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                </div>
              </div>
            </div>

            {bulkResult && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {bulkResult}
              </div>
            )}
            {participantesError && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {participantesError}
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="rounded-2xl border border-signal/20 bg-void/40 overflow-hidden">
              {participantesLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-lavender" />
                </div>
              ) : filteredParticipantes.length === 0 ? (
                <div className="py-20 text-center text-dim/50 text-sm">
                  Nenhum participante encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-lavender/70 border-b border-signal/15">
                        <th className="px-4 py-3 font-medium">Nome</th>
                        <th className="px-4 py-3 font-medium">E-mail</th>
                        <th className="px-4 py-3 font-medium">CPF</th>
                        <th className="px-4 py-3 font-medium">Inscrição</th>
                        <th className="px-4 py-3 font-medium">Presença</th>
                        <th className="px-4 py-3 font-medium">Credencial</th>
                        <th className="px-4 py-3 font-medium">Certificado</th>
                        <th className="px-4 py-3 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipantes.map((p) => (
                        <tr key={p.id} className="border-b border-signal/10 hover:bg-signal/5">
                          <td className="px-4 py-3 font-medium text-data">{p.name}</td>
                          <td className="px-4 py-3 text-dim/80">{p.email}</td>
                          <td className="px-4 py-3 text-dim/70 font-mono text-xs whitespace-nowrap" title={`Final ${p.cpf_last4}`}>
                            •••.•••.{String(p.cpf_last4 || "").slice(0, 1)}-{String(p.cpf_last4 || "").slice(1)} <span className="text-dim/40">Final {p.cpf_last4}</span>
                          </td>
                          <td className="px-4 py-3 text-dim/60 whitespace-nowrap">
                            {p.created_at ? moment(p.created_at).format("DD/MM/YYYY HH:mm") : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {p.attendance_confirmed ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Confirmada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/20 px-2.5 py-1 text-xs text-dim/60">
                                <UserCheck className="h-3.5 w-3.5" />
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {p.wallet_status === "ready" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                                <Wallet className="h-3 w-3" /> Pronta
                              </span>
                            ) : p.wallet_status === "error" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">
                                <AlertCircle className="h-3 w-3" /> Erro
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/20 px-2.5 py-1 text-xs text-dim/60">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Pendente
                              </span>
                            )}
                            {p.wallet_status === "error" && (
                              <button
                                onClick={() => retryWallet(p)}
                                disabled={updatingId === p.id}
                                className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-signal/20 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-dim/70 hover:text-data hover:border-signal/40 transition-all disabled:opacity-50"
                                title="Tentar gerar novamente"
                              >
                                {updatingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                Tentar novamente
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {p.certificate_ready ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                                <BadgeCheck className="h-3 w-3" /> Liberado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-dim/60">
                                <X className="h-3 w-3" /> Não liberado
                              </span>
                            )}
                            <button
                              onClick={() => toggleCertificate(p)}
                              disabled={updatingId === p.id}
                              className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-50 ${p.certificate_ready ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"}`}
                            >
                              {updatingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : p.certificate_ready ? <X className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                              {p.certificate_ready ? "Remover" : "Liberar"}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => toggleAttendance(p)}
                                disabled={updatingId === p.id}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${p.attendance_confirmed ? "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"}`}
                              >
                                {updatingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : p.attendance_confirmed ? <X className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                {p.attendance_confirmed ? "Remover presença" : "Confirmar presença"}
                              </button>
                              <button
                                onClick={() => handleDeleteParticipante(p)}
                                disabled={updatingId === p.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                                title="Remover participante"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remover
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="mt-3 text-[11px] text-dim/40 text-center">
              CPF exibido apenas com 4 últimos dígitos. Dados sensíveis protegidos por hash no banco.
            </p>
            <CheckinScanner
              open={scannerOpen}
              onClose={() => setScannerOpen(false)}
              accessToken={session?.access_token}
              onConfirmed={(p) => {
                setParticipantes((prev) => prev.map((x) => (x.id === p.id ? { ...x, attendance_confirmed: true, attendance_confirmed_at: p.attendance_confirmed_at } : x)));
              }}
            />
          </>
        ) : adminTab === "resultados" ? (
          <ResultsAdmin accessToken={session?.access_token} />
        ) : (
          <>
            {/* Visitas - estatísticas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="rounded-2xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-md px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-lavender/70 font-medium flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> Total de acessos
                </div>
                <div className="mt-1 text-2xl font-semibold text-data">{visitasStats.total}</div>
              </div>
              <div className="rounded-2xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-md px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-lavender/70 font-medium">Hoje</div>
                <div className="mt-1 text-2xl font-semibold text-data">{visitasStats.hoje}</div>
              </div>
              <div className="rounded-2xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-md px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-lavender/70 font-medium flex items-center gap-1.5">
                  <Activity className="h-3 w-3" /> Online (5 min)
                </div>
                <div className="mt-1 text-2xl font-semibold text-data flex items-center gap-2">
                  {visitasStats.online}
                  {visitasStats.online > 0 && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                </div>
              </div>
              <div className="rounded-2xl border border-signal/20 bg-gradient-to-b from-energy/30 to-void/60 backdrop-blur-md px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-lavender/70 font-medium flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> IPs únicos
                </div>
                <div className="mt-1 text-2xl font-semibold text-data">{visitasStats.unicos}</div>
              </div>
            </div>

            <div className="flex justify-end mb-3">
              <button
                onClick={loadVisitas}
                disabled={visitasLoading}
                className="inline-flex items-center gap-1.5 text-xs text-dim/70 hover:text-data disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${visitasLoading ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            </div>

            {visitasError && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {visitasError}
              </div>
            )}

            <div className="rounded-2xl border border-signal/20 bg-void/40 overflow-hidden">
              {visitasLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-lavender" />
                </div>
              ) : visitas.length === 0 ? (
                <div className="py-20 text-center text-dim/50 text-sm">
                  Nenhum acesso registrado ainda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-lavender/70 border-b border-signal/15">
                        <th className="px-4 py-3 font-medium">Horário</th>
                        <th className="px-4 py-3 font-medium">Página</th>
                        <th className="px-4 py-3 font-medium">IP</th>
                        <th className="px-4 py-3 font-medium">Origem</th>
                        <th className="px-4 py-3 font-medium">Navegador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitas.map((v) => (
                        <tr key={v.id} className="border-b border-signal/10 hover:bg-signal/5">
                          <td className="px-4 py-3 text-dim/60 whitespace-nowrap">
                            {v.created_at ? moment(v.created_at).format("DD/MM HH:mm:ss") : "—"}
                          </td>
                          <td className="px-4 py-3 text-data font-mono text-xs">{v.path || "/"}</td>
                          <td className="px-4 py-3 text-dim/80 font-mono text-xs">{v.ip || "—"}</td>
                          <td className="px-4 py-3 text-dim/60 text-xs max-w-[180px] truncate" title={v.referrer || ""}>
                            {v.referrer ? new URL(v.referrer).hostname : "—"}
                          </td>
                          <td className="px-4 py-3 text-dim/50 text-xs max-w-[220px] truncate" title={v.user_agent || ""}>
                            {v.user_agent || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="mt-3 text-[11px] text-dim/40 text-center">
              Atualiza em tempo real via Supabase Realtime. Mostrando até 200 acessos mais recentes.
            </p>
          </>
        )}
      </div>
      </div>
    );
  }
