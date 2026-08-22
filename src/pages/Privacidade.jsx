import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, FileText, Lock, Database, CreditCard, Eye } from "lucide-react";
import Header from "@/components/entec/Header";
import Footer from "@/components/entec/Footer";

export default function Privacidade() {
  return (
    <div className="min-h-screen text-data">
      <Header />
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        {/* Cabeçalho */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-signal/10 border border-signal/20 text-lavender text-[11px] font-medium tracking-[0.16em] uppercase">
            <Shield className="h-3.5 w-3.5" />
            Privacidade e proteção de dados
          </div>
          <h1 className="mt-4 font-display font-bold text-3xl sm:text-4xl text-data leading-tight">
            Política de Privacidade
          </h1>
          <p className="mt-2 font-medium text-lavender">ENTEC 2026 — IFTO Campus Araguatins</p>
          <p className="mt-3 text-xs text-dim/40">
            Última atualização: 22 de agosto de 2026 • Versão 1.0
          </p>
        </motion.div>

        {/* Resumo executivo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mt-8 rounded-2xl border border-signal/15 bg-gradient-to-b from-energy/20 to-void/40 backdrop-blur-md p-5 sm:p-6"
        >
          <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-lavender flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Resumo
          </h2>
          <p className="mt-2 text-sm text-dim/70 leading-relaxed">
            O site do ENTEC 2026 coleta apenas dados estritamente necessários para vender e entregar a camisa oficial,
            processar o pagamento e medir acessos de forma anonimizada. Não vendemos dados, não exibimos anúncios e não
            utilizamos rastreadores de terceiros. O tratamento observa a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
          <div className="mt-4 grid sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
              <div className="font-medium text-data flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-lavender" />
                Onde ficam
              </div>
              <div className="mt-1 text-dim/60 leading-relaxed">Supabase (São Paulo) e Mercado Pago para pagamentos.</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
              <div className="font-medium text-data flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-lavender" />
                Segurança
              </div>
              <div className="mt-1 text-dim/60 leading-relaxed">Preço definido no servidor, HTTPS e acesso restrito ao painel.</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
              <div className="font-medium text-data flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-lavender" />
                Controle
              </div>
              <div className="mt-1 text-dim/60 leading-relaxed">Você pode solicitar acesso, correção ou exclusão.</div>
            </div>
          </div>
        </motion.div>

        {/* Conteúdo */}
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="mt-10 space-y-8 text-sm leading-relaxed"
        >
          <section>
            <h2 className="font-display font-semibold text-data flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/15 border border-signal/20 text-lavender text-xs font-bold">
                1
              </span>
              Controlador e contato
            </h2>
            <p className="mt-3 text-dim/75">
              Controladora: Comissão Organizadora do ENTEC 2026 — Curso Técnico em Redes de Computadores, IFTO Campus
              Araguatins. Encarregado (DPO): contato via secretaria do campus ou e-mail institucional divulgado nos canais
              oficiais do IFTO. Para exercer direitos sobre seus dados, utilize os mesmos canais.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/15 border border-signal/20 text-lavender text-xs font-bold">
                2
              </span>
              Dados tratados
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-signal/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.04] text-left text-[11px] uppercase tracking-[0.12em] text-lavender/70">
                    <th className="px-4 py-2.5 font-medium">Categoria</th>
                    <th className="px-4 py-2.5 font-medium">Dados</th>
                    <th className="px-4 py-2.5 font-medium">Finalidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-dim/75">
                  <tr>
                    <td className="px-4 py-3 font-medium text-data whitespace-nowrap">Compra da camisa</td>
                    <td className="px-4 py-3">Nome completo, nome na camisa (opcional), telefone, e-mail institucional, tamanho (PP–G, Baby Look), gênero, valor, status</td>
                    <td className="px-4 py-3">Produção, separação e entrega; controle no painel administrativo</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-data">Pagamento</td>
                    <td className="px-4 py-3">Nome, e-mail, telefone e valor calculados no servidor; ID de preferência e status retornados pelo Mercado Pago</td>
                    <td className="px-4 py-3">Criar checkout, confirmar pagamento via webhook e atualizar status para “pago”</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-data">Acesso técnico</td>
                    <td className="px-4 py-3">Página (path), IP, user-agent, referrer; carimbo de data/hora</td>
                    <td className="px-4 py-3">Métricas de acesso (total/hoje/online/IPs únicos) e segurança; dedup de 5 min e exclusão de bots/admin</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-data">Administrativo</td>
                    <td className="px-4 py-3">E-mail e senha do administrador (Supabase Auth)</td>
                    <td className="px-4 py-3">Autenticar acesso ao painel /admin</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-dim/50">
              Não coletamos localização precisa, documentos, dados biométricos ou cookies de publicidade.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/15 border border-signal/20 text-lavender text-xs font-bold">
                3
              </span>
              Bases legais
            </h2>
            <ul className="mt-3 list-disc pl-5 space-y-1 text-dim/75">
              <li>
                <strong className="text-data">Execução de contrato</strong> (art. 7º, V, LGPD) — compra e entrega da camisa.
              </li>
              <li>
                <strong className="text-data">Legítimo interesse</strong> (art. 7º, IX) — métricas de acesso e proteção contra fraude, com impacto mínimo à privacidade.
              </li>
              <li>
                <strong className="text-data">Cumprimento de obrigação legal</strong> (art. 7º, II) — quando aplicável à guarda fiscal/contábil.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/15 border border-signal/20 text-lavender text-xs font-bold">
                4
              </span>
              Compartilhamento e operadores
            </h2>
            <div className="mt-3 grid sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-signal/10 bg-white/[0.02] p-4">
                <div className="text-xs font-semibold text-data flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-lavender" />
                  Supabase
                </div>
                <p className="mt-1 text-xs text-dim/60 leading-relaxed">Banco (Postgres) e Auth em São Paulo. Tabelas <code>inscricoes</code> e <code>visitas</code> com RLS; apenas autenticados leem o painel.</p>
              </div>
              <div className="rounded-xl border border-signal/10 bg-white/[0.02] p-4">
                <div className="text-xs font-semibold text-data flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-lavender" />
                  Mercado Pago
                </div>
                <p className="mt-1 text-xs text-dim/60 leading-relaxed">Recebe nome, e-mail, telefone e valor para gerar o checkout. Pagamento processado no ambiente deles.</p>
              </div>
              <div className="rounded-xl border border-signal/10 bg-white/[0.02] p-4">
                <div className="text-xs font-semibold text-data">Netlify</div>
                <p className="mt-1 text-xs text-dim/60 leading-relaxed">Hospedagem estática; logs de CDN podem existir no provedor.</p>
              </div>
            </div>
            <p className="mt-3 text-dim/75">Não comercializamos dados. Compartilhamento ocorre apenas para viabilizar o funcionamento acima.</p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/15 border border-signal/20 text-lavender text-xs font-bold">
                5
              </span>
              Cookies e tecnologias similares
            </h2>
            <p className="text-dim/75">
              O site não utiliza cookies de publicidade ou rastreadores de terceiros. São usados apenas recursos técnicos
              essenciais: armazenamento local do Supabase Auth para manter a sessão do administrador e, eventualmente,
              preferências de interface. Você pode limpar o armazenamento do navegador a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/15 border border-signal/20 text-lavender text-xs font-bold">
                6
              </span>
              Segurança
            </h2>
            <ul className="mt-3 list-disc pl-5 space-y-1 text-dim/75">
              <li>Preço da camisa definido exclusivamente no backend (<code>create-payment</code>); valor enviado pelo navegador é desconsiderado.</li>
              <li>Validação de e-mail institucional, tamanho, gênero e nome da camisa no frontend e no servidor.</li>
              <li>Links de pagamento expiram em 1 hora; inscrições pendentes são removidas automaticamente após 1 hora (cron horário).</li>
              <li>Painel administrativo protegido por autenticação e políticas RLS (leitura/edição/exclusão apenas para autenticados).</li>
              <li>Comunicação com Supabase e Mercado Pago via HTTPS.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/15 border border-signal/20 text-lavender text-xs font-bold">
                7
              </span>
              Retenção
            </h2>
            <ul className="mt-3 list-disc pl-5 space-y-1 text-dim/75">
              <li>
                <strong className="text-data">Inscrições pagas:</strong> mantidas enquanto necessárias para entrega, financeiro e cumprimento de obrigações legais/fiscais.
              </li>
              <li>
                <strong className="text-data">Inscrições pendentes:</strong> expiram em 1 hora e são excluídas automaticamente; podem ser removidas manualmente no painel.
              </li>
              <li>
                <strong className="text-data">Visitas:</strong> mantidas para estatísticas; plano gratuito comporta centenas de milhares de registros. Exclusão sob demanda via solicitação.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/15 border border-signal/20 text-lavender text-xs font-bold">
                8
              </span>
              Seus direitos
            </h2>
            <p className="text-dim/75">
              Nos termos da LGPD (arts. 18 e 20), você pode solicitar confirmação, acesso, correção, anonimização, bloqueio,
              eliminação, portabilidade e informação sobre compartilhamento, além de revogar consentimento quando aplicável e
              solicitar revisão de decisões automatizadas. Atenderemos em prazo legal, observados segredos comerciais e
              obrigações legais. Para exercer, contate a organização pelos canais oficiais do IFTO Campus Araguatins.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-signal/15 border border-signal/20 text-lavender text-xs font-bold">
                9
              </span>
              Atualizações
            </h2>
            <p className="text-dim/75">
              Esta política pode ser atualizada para refletir mudanças técnicas ou legais. A data no topo indica a versão vigente.
              Alterações relevantes serão divulgadas nos canais do evento.
            </p>
          </section>

          <div className="pt-6 border-t border-signal/10 flex flex-col sm:flex-row gap-3">
            <Link to="/" className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-signal text-data text-sm font-medium hover:bg-signal/90 transition-colors">
              Voltar ao início
            </Link>
            <Link to="/sobre" className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-signal/20 text-data text-sm hover:bg-signal/10 transition-colors">
              Conheça o ENTEC
            </Link>
          </div>
        </motion.article>
      </div>
      <Footer />
    </div>
  );
}
