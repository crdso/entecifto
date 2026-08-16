import React from "react";
import { motion } from "framer-motion";
import PageHeader from "@/components/entec/PageHeader";
import ImagePlaceholder from "@/components/entec/ImagePlaceholder";

// ============================================================
//  CONTEÚDO EDITÁVEL DA PÁGINA SOBRE
//  Texto contínuo (apenas parágrafos), com imagens de apoio entre eles.
//  Substitua o texto provisório abaixo pela apresentação definitiva.
// ============================================================
const PARAGRAFOS_INICIAIS = [
  "O ENTEC — Encontro de Tecnologia do Instituto Federal do Tocantins — é um espaço dedicado à troca de experiências, à apresentação de trabalhos e ao debate sobre os caminhos da tecnologia. Desde sua primeira edição, reúne estudantes, docentes, pesquisadores e profissionais em torno de temas que refletem as transformações do nosso tempo.",
  "Ao longo dos anos, o evento cresceu e acompanhou as mudanças do setor, incorporando novos formatos, áreas de discussão e formas de participação. O que começou como um encontro modesto tornou-se uma referência para a comunidade acadêmica e tecnológica da região, mantendo viva a vocação de aproximar a academia das demandas reais da sociedade.",
];

const PARAGRAFOS_FINAIS = [
  "A ENTEC existe para aproximar quem produz conhecimento de quem deseja aprendê-lo e aplicá-lo. Palestras, minicursos, oficinas e mostras de trabalhos convivem em uma programação pensada para inspirar e conectar pessoas, abrindo espaço para conversas que ultrapassam os limites da sala de aula.",
  "Mais do que um evento, a ENTEC é um convite a pensar o futuro. Cada edição deixa perguntas, ideias e parcerias que continuam a ecoar muito depois de seu encerramento, reforçando o compromisso do IFTO com a educação, a inovação e o desenvolvimento sustentável da região.",
  "Este texto é provisório e será substituído pela apresentação definitiva do evento. Aqui você poderá contar, de forma contínua e fluida, a história da ENTEC, seus princípios, seus personagens e seus principais momentos.",
];

export default function Sobre() {
  return (
    <div className="min-h-screen text-data">
      <PageHeader />

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-2xl mx-auto px-6 pt-24 pb-28 space-y-6"
      >
        {PARAGRAFOS_INICIAIS.map((p, i) => (
          <p key={i} className="text-lg leading-relaxed text-dim/80">
            {p}
          </p>
        ))}

        <ImagePlaceholder label="Imagem" className="my-10 h-56" />

        {PARAGRAFOS_FINAIS.map((p, i) => (
          <p key={i} className="text-lg leading-relaxed text-dim/80">
            {p}
          </p>
        ))}

        <ImagePlaceholder label="Imagem" className="my-10 h-56" />
      </motion.article>
    </div>
  );
}