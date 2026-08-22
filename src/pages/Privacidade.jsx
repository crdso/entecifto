import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import Header from "@/components/entec/Header";
import Footer from "@/components/entec/Footer";

export default function Privacidade() {
  return (
    <div className="min-h-screen text-data">
      <Header />
      <div className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-signal/10 border border-signal/20 text-lavender text-[11px] font-medium tracking-[0.16em] uppercase">
            <Shield className="h-3.5 w-3.5" />
            Privacidade
          </div>
          <h1 className="mt-4 font-display font-bold text-3xl sm:text-4xl text-data leading-tight">
            Política de Privacidade
          </h1>
          <p className="mt-2 text-xs text-dim/40">Última atualização: agosto de 2026</p>
          <p className="mt-4 text-sm text-dim/70 leading-relaxed max-w-2xl mx-auto">
            Esta Política de Privacidade explica de forma simples como o site oficial do <strong className="text-data">ENTEC 2026</strong> trata as informações necessárias para seu funcionamento, para a aquisição da camisa oficial do evento e para o acompanhamento de acessos ao site.
          </p>
        </motion.div>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-10 space-y-8 text-sm leading-relaxed text-dim/75"
        >
          <section>
            <h2 className="font-display font-semibold text-data text-[15px]">1. Dados fornecidos na compra da camisa</h2>
            <p className="mt-2">Ao solicitar a camisa oficial do ENTEC 2026, poderão ser solicitados:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>nome completo;</li>
              <li>nome a ser colocado na camisa, quando informado;</li>
              <li>telefone;</li>
              <li>e-mail institucional;</li>
              <li>gênero/modelagem escolhida;</li>
              <li>tamanho da camisa.</li>
            </ul>
            <p className="mt-3">
              Essas informações são utilizadas exclusivamente para registrar o pedido, identificar o comprador, aplicar as regras de preço ou desconto quando cabíveis, organizar a produção e a entrega das camisas e prestar suporte relacionado à compra.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-[15px]">2. Pagamentos</h2>
            <p className="mt-2">
              Os pagamentos são processados por meio do <strong className="text-data">Mercado Pago</strong>.
            </p>
            <p className="mt-2">
              Para gerar o checkout, algumas informações necessárias à identificação da compra, como nome, e-mail e telefone, são encaminhadas ao Mercado Pago.
            </p>
            <p className="mt-2">
              Os dados utilizados diretamente para realizar o pagamento, como informações de cartão, Pix ou outros meios disponibilizados no checkout, são tratados no ambiente do Mercado Pago e não são armazenados pelo site do ENTEC.
            </p>
            <p className="mt-2">
              O sistema mantém apenas informações necessárias ao acompanhamento do pedido, como identificador do pagamento, situação do pagamento, método utilizado e data de aprovação.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-[15px]">3. Dados de acesso ao site</h2>
            <p className="mt-2">Para acompanhar o funcionamento e a utilização do site, podem ser registrados automaticamente:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>endereço IP;</li>
              <li>página acessada;</li>
              <li>navegador e informações técnicas do dispositivo;</li>
              <li>página ou site de origem do acesso, quando disponível;</li>
              <li>data e horário do acesso.</li>
            </ul>
            <p className="mt-3">
              Esses registros são utilizados para gerar métricas de acesso, identificar problemas técnicos, evitar contagens duplicadas e auxiliar na segurança e administração do site.
            </p>
            <p className="mt-2">Não utilizamos essas informações para publicidade direcionada.</p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-[15px]">4. Armazenamento e serviços utilizados</h2>
            <p className="mt-2">
              Os dados relacionados aos pedidos e aos registros técnicos do site são armazenados utilizando a infraestrutura do <strong className="text-data">Supabase</strong>.
            </p>
            <p className="mt-2">
              O <strong className="text-data">Mercado Pago</strong> é utilizado exclusivamente para processamento e confirmação dos pagamentos.
            </p>
            <p className="mt-2">Esses serviços possuem suas próprias políticas e práticas de privacidade e segurança.</p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-[15px]">5. Compartilhamento de dados</h2>
            <p className="mt-2">Os dados pessoais não são vendidos ou comercializados.</p>
            <p className="mt-2">Eles poderão ser compartilhados apenas quando necessário para:</p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>processar o pagamento;</li>
              <li>manter o funcionamento técnico do site;</li>
              <li>organizar e entregar as camisas;</li>
              <li>cumprir obrigações legais, quando aplicável.</li>
            </ul>
            <p className="mt-3">O acesso administrativo às informações é destinado à organização responsável pelo ENTEC 2026.</p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-[15px]">6. Conservação dos dados</h2>
            <p className="mt-2">
              Os dados são mantidos somente pelo período necessário para as finalidades relacionadas ao evento, às compras, à entrega das camisas, à administração do site e ao cumprimento de eventuais obrigações aplicáveis.
            </p>
            <p className="mt-2">Pedidos com pagamento pendente ou não concluído poderão ser removidos após a expiração do processo de pagamento.</p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-[15px]">7. Segurança</h2>
            <p className="mt-2">São utilizadas medidas técnicas para limitar o acesso aos dados e proteger as informações armazenadas.</p>
            <p className="mt-2">
              Ainda assim, nenhum sistema conectado à internet pode garantir segurança absoluta, e são adotadas medidas compatíveis com a finalidade e o porte deste site.
            </p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-[15px]">8. Direitos do titular</h2>
            <p className="mt-2">
              Nos termos da Lei Geral de Proteção de Dados Pessoais — <strong className="text-data">LGPD (Lei nº 13.709/2018)</strong> — o titular poderá solicitar, quando aplicável:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>confirmação da existência de tratamento de seus dados;</li>
              <li>acesso aos dados armazenados;</li>
              <li>correção de informações incorretas;</li>
              <li>exclusão ou anonimização de dados quando cabível;</li>
              <li>esclarecimentos sobre a utilização de suas informações.</li>
            </ul>
            <p className="mt-3">Solicitações relacionadas à privacidade poderão ser feitas pelos canais oficiais de contato do ENTEC 2026.</p>
          </section>

          <section>
            <h2 className="font-display font-semibold text-data text-[15px]">9. Alterações nesta política</h2>
            <p className="mt-2">Esta Política de Privacidade poderá ser atualizada caso ocorram mudanças relevantes no funcionamento do site ou na forma como os dados são tratados.</p>
            <p className="mt-2">A versão mais recente estará sempre disponível nesta página.</p>
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
