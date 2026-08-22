import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Header from "@/components/entec/Header";
import Footer from "@/components/entec/Footer";

export default function Privacidade() {
  return (
    <div className="min-h-screen text-data">
      <Header />
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto px-6 pt-28 pb-16"
      >
        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.2em] uppercase text-lavender">Transparência</p>
          <h1 className="mt-3 font-display font-bold text-3xl sm:text-4xl text-data">Política de Privacidade — ENTEC 2026</h1>
          <p className="mt-2 text-xs text-dim/50">Última atualização: 22 de agosto de 2026</p>
          <p className="mt-4 text-sm text-dim/70 leading-relaxed max-w-2xl mx-auto">
            Esta política descreve, de forma direta, quais dados o site oficial do ENTEC 2026 coleta, para que são usados
            e como são protegidos. Ela reflete o funcionamento real do código em produção.
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-dim/80">
          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">1. Quem é o responsável</h2>
            <p>
              O site <strong className="text-data">entecifto</strong> é mantido pela comissão organizadora do ENTEC 2026,
              evento do curso Técnico em Redes de Computadores do IFTO — Campus Araguatins. Para dúvidas sobre privacidade,
              utilize os canais de contato divulgados pela organização do evento.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">2. Quais dados coletamos</h2>
            <p className="mb-2">O site coleta apenas o necessário para funcionar:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-data">Dados da compra da camisa</strong> — nome completo, nome para estampar na camisa
                (opcional), telefone, e-mail institucional (@estudante.ifto.edu.br ou outro, conforme validação), tamanho
                (PP/P/M/G e Baby Look), gênero (Masculino/Feminino), valor e status do pedido. Esses dados são informados
                por você no modal “Adquira sua camisa”.
              </li>
              <li>
                <strong className="text-data">Dados de pagamento</strong> — ao confirmar a compra, o site cria uma preferência no
                Mercado Pago com nome, e-mail, telefone e valor calculado no servidor. O processamento do pagamento
                (Pix, boleto, cartão) acontece no ambiente do Mercado Pago.
              </li>
              <li>
                <strong className="text-data">Registros técnicos de acesso</strong> — a cada visita, a função <code className="px-1 py-0.5 rounded bg-white/5 border border-signal/15 text-xs">track-visit</code> registra:
                página acessada (<code>path</code>), endereço IP, navegador (<code>user-agent</code>) e página de origem
                (<code>referrer</code>). O IP é extraído de cabeçalhos de proxy (<code>x-nf-client-connection-ip</code>,{" "}
                <code>cf-connecting-ip</code>, <code>x-forwarded-for</code>) e bots são descartados. Acessos do administrador
                logado não são contabilizados e recargas no mesmo IP/página em até 5 minutos são deduplicadas.
              </li>
              <li>
                <strong className="text-data">Acesso administrativo</strong> — e-mail e senha do administrador são gerenciados pelo
                Supabase Auth (login do painel <code>/admin</code>).
              </li>
            </ul>
            <p className="mt-2 text-dim/60 text-xs">
              Não coletamos localização precisa, não usamos cookies de publicidade e não fazemos rastreamento de terceiros
              além do necessário para hospedagem e pagamento.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">3. Para que usamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Processar e entregar o pedido da camisa (produção, separação por tamanho/modelo e entrega).</li>
              <li>Criar e confirmar o pagamento via Mercado Pago e atualizar o status para “pago” via webhook.</li>
              <li>Exibir no painel administrativo a lista de pedidos, controle de entrega e financeiro (bruto, taxas, líquido).</li>
              <li>Medir acessos (total, hoje, online, IPs únicos) e exibir no painel em tempo real, sem identificar pessoas.</li>
              <li>Garantir segurança, prevenir fraudes e depurar erros (ex.: validar e-mail institucional, tamanho, preço no servidor).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">4. Onde os dados ficam e com quem são compartilhados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-data">Supabase</strong> (banco de dados e autenticação, região São Paulo) — armazena inscrições
                (<code>inscricoes</code>) e visitas (<code>visitas</code>). Acesso ao painel exige login e política RLS.
              </li>
              <li>
                <strong className="text-data">Mercado Pago</strong> — recebe apenas os dados mínimos para criar a preferência de
                pagamento (nome, e-mail, telefone, valor e referência externa). O pagamento em si é processado por eles.
              </li>
              <li>
                <strong className="text-data">Netlify</strong> (hospedagem) — serve o site estático; logs técnicos de CDN podem existir
                no provedor, fora do controle direto desta aplicação.
              </li>
            </ul>
            <p className="mt-2">Não vendemos, alugamos ou compartilhamos seus dados com terceiros para marketing.</p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">5. Base legal (LGPD)</h2>
            <p>
              Tratamos dados com base na <strong className="text-data">execução de contrato</strong> (compra e entrega da camisa),
              <strong className="text-data"> legítimo interesse</strong> (métricas de acesso e segurança) e{" "}
              <strong className="text-data">cumprimento de obrigação</strong> quando aplicável. O titular pode solicitar
              informações, correção ou exclusão, respeitados prazos legais e contratuais.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">6. Segurança</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Preço da camisa é definido <strong className="text-data">exclusivamente no backend</strong> (
                <code>create-payment</code>). Valor enviado pelo navegador é ignorado e recalculado (R$ 60 cheio, R$ 50/55 para
                e-mails com desconto, uso único após pagamento aprovado, expiração em 1h).
              </li>
              <li>Validação de e-mail institucional, tamanho, gênero e nome da camisa no frontend e no backend.</li>
              <li>Acesso ao painel protegido por e-mail/senha e RLS (apenas autenticados leem/atualizam/deletam).</li>
              <li>Comunicação com Supabase e Mercado Pago via HTTPS.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">7. Retenção</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong className="text-data">Inscrições</strong>: mantidas enquanto necessárias para entrega, prestação de contas e
                financeiro do evento. Você pode pedir exclusão via contato da organização; pedidos pagos podem ser mantidos por
                obrigação legal/fiscal.
              </li>
              <li>
                <strong className="text-data">Pendentes não pagos</strong>: expiram em 1h (link do Mercado Pago) e são removidos
                automaticamente após 1h por rotina horária (<code>pg_cron</code>) ou manualmente no painel.
              </li>
              <li>
                <strong className="text-data">Visitas</strong>: mantidas para estatísticas; o plano gratuito do Supabase comporta
                centenas de milhares de linhas (500 MB). Não há limpeza automática configurada.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">8. Seus direitos</h2>
            <p>
              Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, exclusão ou
              portabilidade dos seus dados, além de revogar consentimento quando aplicável. Para exercer seus direitos, entre
              em contato pelos canais oficiais do ENTEC 2026/IFTO Campus Araguatins.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">9. Contato</h2>
            <p>
              Dúvidas sobre esta política ou sobre seus dados: procure a comissão organizadora do ENTEC 2026 no IFTO — Campus
              Araguatins ou utilize o e-mail institucional divulgado no site do campus.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-base mb-2">10. Atualizações</h2>
            <p>
              Esta política pode ser atualizada para refletir mudanças no site. A data no topo indica a última revisão.
              Alterações relevantes serão comunicadas nos canais do evento.
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
        </div>
      </motion.article>
      <Footer />
    </div>
  );
}
