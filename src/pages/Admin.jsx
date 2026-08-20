import React, { useState, useEffect, useMemo } from "react";
import { Search, Loader2, ShieldCheck, LogOut, PackageCheck, Package, Copy, CopyCheck, Eye, Activity, Users, Globe, RefreshCw } from "lucide-react";
import moment from "moment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectRows, supabase, updateRow } from "@/lib/supabase";

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

  const isAllowed = (user) => !ADMIN_EMAIL || (user?.email || "").trim().toLowerCase() === ADMIN_EMAIL;

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
        setError("Acesso restrito. Esta conta não tem permissão para o painel administrativo.");
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
            setError("Acesso restrito. Esta conta não tem permissão para o painel administrativo.");
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

  useEffect(() => {
    if (session) {
      load();
      loadVisitas();
    } else {
      setRows([]);
      setVisitas([]);
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
      setError("Acesso restrito. Esta conta não tem permissão para o painel administrativo.");
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
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 border-signal/20 text-data">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setAdminTab("inscricoes")}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${adminTab === "inscricoes" ? "border-signal bg-signal/20 text-data" : "border-signal/20 text-dim/70 hover:border-signal/50 hover:text-data"}`}
          >
            Inscrições
          </button>
          <button
            onClick={() => { setAdminTab("visitas"); loadVisitas(); }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${adminTab === "visitas" ? "border-signal bg-signal/20 text-data" : "border-signal/20 text-dim/70 hover:border-signal/50 hover:text-data"}`}
          >
            <Eye className="h-4 w-4" />
            Acessos {visitasStats.online > 0 && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
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
                          <div className="flex gap-1.5">
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
