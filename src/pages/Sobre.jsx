import React from "react";
import { motion } from "framer-motion";
import Header from "@/components/entec/Header";
import Footer from "@/components/entec/Footer";

// ============================================================
//  CONTEÚDO EDITÁVEL DA PÁGINA SOBRE
//  Texto contínuo (apenas parágrafos), com imagens de apoio entre eles.
//  Substitua o texto provisório abaixo pela apresentação definitiva.
// ============================================================
const PARAGRAFOS_INICIAIS = [
  "O ENTEC — Encontro Tecnológico — é um evento realizado pelos alunos do 3º ano do curso Técnico em Redes de Computadores integrado ao Ensino Médio do IFTO — Campus Araguatins. Há mais de cinco anos, o encontro faz parte da trajetória do curso, reunindo alunos, professores e convidados em uma programação voltada à tecnologia e aos conhecimentos desenvolvidos durante a formação.",
  "A cada ano, o ENTEC ganha uma nova identidade. Temas, ambientação e atividades são renovados para criar uma experiência diferente para quem participa. Tecnologia, cultura e criatividade se encontram na programação, permitindo que assuntos estudados ao longo do curso sejam apresentados de uma forma mais dinâmica e próxima do público.",
];

const PARAGRAFOS_FINAIS = [
  "O evento é também uma oportunidade para os próprios alunos colocarem em prática o que aprenderam. Da organização à realização das atividades, a turma participa diretamente da construção do ENTEC, assumindo responsabilidades e trabalhando em conjunto para transformar o planejamento feito durante o ano em um evento aberto à comunidade.",
  "Ao longo de sua história, o ENTEC já recebeu palestras, minicursos, apresentações, jogos, concursos, sorteios e outras atividades. A programação muda a cada edição, acompanhando tanto as propostas da turma responsável quanto os novos assuntos e tendências que surgem no universo da tecnologia.",
  "Mais do que apresentar conteúdos técnicos, o ENTEC representa um dos momentos que marcam a conclusão do curso de Redes de Computadores no Campus Araguatins. É quando conhecimento, criatividade e trabalho em equipe saem da sala de aula e ganham espaço para serem compartilhados com outras pessoas.",
];

export default function Sobre() {
  return (
    <div className="min-h-screen text-data">
      <Header />

      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-3xl mx-auto px-6 pt-24 pb-28"
      >
        <header className="text-center mb-12">
          <p className="text-xs sm:text-sm font-medium tracking-[0.3em] uppercase text-lavender">
            Encontro de Tecnologia · IFTO
          </p>
          <h1
            className="mt-3 font-tech font-extrabold text-4xl sm:text-6xl tracking-[0.04em] text-transparent bg-clip-text bg-gradient-to-r from-signal via-data to-signal bg-[length:200%_auto] animate-shimmer"
            style={{
              filter: "drop-shadow(0 0 24px rgba(58,1,138,0.4))",
              animationDuration: "6s",
            }}
          >
            SOBRE O ENTEC
          </h1>
          <div className="mt-6 mx-auto h-px w-24 bg-gradient-to-r from-transparent via-signal to-transparent" />
        </header>

        <div className="space-y-6">
          {PARAGRAFOS_INICIAIS.map((p, i) => (
            <p key={i} className="text-lg leading-relaxed text-dim/80">
              {p}
            </p>
          ))}
        </div>

        <figure className="relative my-12 overflow-hidden rounded-2xl border border-signal/25 shadow-[0_0_40px_rgba(58,1,138,0.25)]">
          <img
            src="/images/banner.png"
            alt="Banner ENTEC 2026"
            className="w-full h-auto object-cover"
          />
        </figure>

        <div className="space-y-6">
          {PARAGRAFOS_FINAIS.map((p, i) => (
            <p key={i} className="text-lg leading-relaxed text-dim/80">
              {p}
            </p>
          ))}
        </div>
      </motion.article>

      <Footer />
    </div>
  );
}