import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, CircleCheck, Target, ArrowDown, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { AppEntryGateModal } from "@/components/site/AppEntryGateModal";
import { useAppEntryGate } from "@/hooks/useAppEntryGate";
import { PoliaWordmark } from "@/components/brand/PoliaLogo";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { gatePublico } from "@/lib/site-gate";
import { Reveal, RevealGroup, RevealItem } from "@/components/site/Reveal";
import { HighlightWord } from "@/components/site/HighlightWord";

export const Route = createFileRoute("/")({
  beforeLoad: gatePublico,
  head: () => ({
    meta: [
      {
        title: "Pólia · Descubra se o seu negócio dá lucro",
      },
      {
        name: "description",
        content:
          "Veja quanto sobra em cada venda, sem planilha e sem achismo. Isso começa no Planejamento, quando você decide quem sua marca atende, o que entrega e quanto vale, e vira preço, caixa e meta, tudo ligado.",
      },
      {
        property: "og:title",
        content: "Pólia · Descubra se o seu negócio dá lucro",
      },
      {
        property: "og:description",
        content: "Ver quanto sobra em cada venda e cobrar o que o negócio vale, no mesmo lugar.",
      },
    ],
  }),
  component: HomePage,
});

const mecanismo = [
  {
    n: "01",
    titulo: "Defina a marca",
    desc: "Quem ela atende, o que entrega e quanto cobra. Decidido, não chutado.",
  },
  {
    n: "02",
    titulo: "Veja quanto sobra",
    desc: "Cada preço mostra o lucro que sobra antes de você fechar.",
  },
  {
    n: "03",
    titulo: "Marque a venda",
    desc: "Entregou, o dinheiro cai no caixa sozinho. Sem lançar de novo.",
  },
  {
    n: "04",
    titulo: "Acompanhe a meta",
    desc: "Saiba hoje se está no ritmo, não no fim do mês, quando não dá mais pra reagir.",
  },
];

const modulos = [
  {
    titulo: "É aqui que o negócio inteiro ganha forma",
    nomeModulo: "Planejamento",
    body: "Seis módulos onde você responde quem sua marca atende, o que entrega e quanto vale. Não é discurso de missão que morre na gaveta. É a decisão que define o seu preço, a sua meta e o rumo do negócio.",
    printLabel: "print do Planejamento",
  },
  {
    titulo: "Você vê o que sobra em cada venda",
    nomeModulo: "Produtos",
    body: "A margem de cada produto fica numa barra que você lê de relance, do lado do custo e do preço. O que sobra da venda para de ser achismo e vira número na frente do produto.",
    printLabel: "print de Produtos",
  },
  {
    titulo: "A entrega vira caixa sozinha",
    nomeModulo: "Clientes",
    body: "Marque que o produto ou serviço foi entregue e a venda entra sozinha no financeiro da empresa. Sem lançar de novo, sem abrir outra planilha.",
    printLabel: "print de Clientes",
  },
  {
    titulo: "O extrato deixa de ser surpresa",
    nomeModulo: "Financeiro",
    body: "Entradas, saídas e lucro do mês num lugar só, com uma régua que mostra onde você está entre o mês mínimo e o mês bom. As referências vêm do seu Planejamento, não de um número que você chutou.",
    printLabel: "print de Financeiro",
  },
  {
    titulo: "Você abre e já sabe quanto falta",
    nomeModulo: "Painel",
    body: "Receita do mês, pedidos, tarefas do dia e quanto falta pra fechar a meta, tudo na primeira tela. O número que decide o seu mês não fica escondido em aba nenhuma.",
    printLabel: "print do Painel",
  },
  {
    titulo: "O que precisa sair essa semana não se perde",
    nomeModulo: "Planner",
    body: "Quadro de projetos e tarefas pra organizar o que a semana pede, ligado à mesma meta que você definiu no Planejamento. Decisão boa não vale nada se a entrega se perde no meio do caminho.",
    printLabel: "print do Planner",
  },
];

const qualificacaoSim = [
  "Você já tem produto ou serviço rodando, mas ainda cobra no chute.",
  "Você cobra, mas trava quando alguém pergunta como chegou naquele preço.",
  "Sua conta pessoal e a da marca ainda são a mesma conta.",
  "Você decide sozinha e não tem ninguém pra confirmar se o número fecha.",
];

const qualificacaoNao = [
  "Você ainda não decidiu o que vai vender. A Pólia começa depois disso.",
  "Você procura ferramenta de anúncio ou automação de marketing. A Pólia não faz isso.",
  "Você tem equipe e processo já rodando. A Pólia é feita pra quem toca sozinha.",
];

const planos = [
  {
    nome: "Confere",
    preco: "R$ 0",
    ciclo: "pra sempre",
    precoAnual: null,
    praQuem: "Confere se o seu negócio dá lucro.",
    features: [
      "Precificar até 5 produtos, ver o lucro de cada um e quanto sobra pra você",
      "1 Planner, 1 Caderno e Painel básico",
      "Planejamento completo, com 1 geração por IA",
      "Chatbot Aimer pra tirar dúvida na hora",
    ],
    botaoLabel: "Criar conta grátis",
    apoio: "Sem cartão, e é seu pra sempre.",
    destaque: false,
    href: "/auth/cadastro",
  },
  {
    nome: "Controle",
    preco: "R$ 29,90",
    ciclo: "/mês",
    precoAnual: "ou R$ 299 por ano, dois meses saem de graça",
    praQuem: "Controle o negócio inteiro, mês a mês.",
    features: [
      "Tudo do Confere, mais:",
      "Financeiro completo, contínuo: caixa e memória mês a mês",
      "Catálogo e Clientes ilimitados",
      "Metas, Calendário e Mapa de Mercado",
      "Re-gerações do Planejamento por IA",
    ],
    botaoLabel: "Assinar o Controle",
    apoio: "O produto inteiro usado todo dia.",
    destaque: true,
    href: "/assinar?plano=controle",
  },
  {
    nome: "Projete",
    preco: "R$ 47,90",
    ciclo: "/mês",
    precoAnual: "ou R$ 479 por ano, dois meses saem de graça",
    praQuem: "A Pólia lê os números e diz o que fazer.",
    features: [
      "Tudo do Controle, mais:",
      "Projeção e cenários: quanto vender pra se pagar",
      "Precificação inteligente (encomenda, hora, meta)",
      "Raio-x do mês pela IA + relatório pro contador",
      "Plano de conteúdo do ano",
    ],
    botaoLabel: "Assinar o Projete",
    apoio: "Pra quando a marca está pronta pra crescer.",
    destaque: false,
    href: "/assinar?plano=projete",
  },
];

const faqs = [
  {
    pergunta: "Tem versão grátis mesmo?",
    resposta:
      "Tem, e não é teste que expira. O Confere é seu pra sempre: você monta o Planejamento inteiro da marca e acompanha o Painel básico sem colocar cartão. Quando quiser o resto do negócio num lugar só, passa pro Controle.",
  },
  {
    pergunta: "Posso cancelar quando quiser?",
    resposta:
      "Pode, num clique, direto nas configurações. Você continua com acesso até o fim do período que já pagou. Depois disso volta pro Confere, e o seu Planejamento fica intacto.",
  },
  {
    pergunta: "O preço pode mudar depois?",
    resposta:
      "Se a gente reajustar os planos algum dia, quem já assina mantém o valor que contratou. Você não descobre um preço novo de um mês pro outro.",
  },
  {
    pergunta: "Quais as formas de pagamento?",
    resposta:
      "Cartão e boleto valem no plano mensal e no anual. O Pix é uma opção quando você escolhe pagar o ano de uma vez.",
  },
  {
    pergunta: "Posso trocar de plano depois?",
    resposta:
      "Pode, quando quiser. Sobe pro Projete ou volta pro Controle nas configurações, e o valor se ajusta sozinho na próxima cobrança.",
  },
];

function HomePage() {
  const { mostrarModal, escondendoHome, explorar } = useAppEntryGate();
  const [mostrarCtaFlutuante, setMostrarCtaFlutuante] = useState(false);

  useEffect(() => {
    const onScroll = () => setMostrarCtaFlutuante(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // App Android/iOS com sessão ativa (ou sessão ainda carregando): a Home de
  // marketing não deve piscar antes do redirect automático pro painel.
  if (escondendoHome) return null;

  return (
    <div className="polia-v3 min-h-screen bg-white text-[var(--ink)]">
      {mostrarModal && <AppEntryGateModal onExplorar={explorar} />}
      <SiteHeader />

      <AnimatePresence>
        {mostrarCtaFlutuante && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 z-30 hidden md:block"
          >
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/"
                hash="planos"
                data-track="cadastro_cta_clicado"
                data-track-props='{"contexto":"flutuante"}'
                className="inline-flex items-center gap-2 rounded-full border border-[var(--ink)] bg-[var(--secondary)] px-6 py-3 text-[15px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                Quero ver se dá lucro
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        {/* 1. HERO — tela quase cheia, tinta cheia, tipografia enorme, destaque animado */}
        <section className="relative flex min-h-[92vh] flex-col justify-center overflow-hidden bg-[var(--ink)] pb-16 pt-12 text-[var(--bg)] md:pt-16">
          <div className="mx-auto w-full max-w-[1120px] px-6">
            <Reveal delay={0.05}>
              <p className="font-cabinet text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--secondary)]">
                Planejamento · Preço · Caixa · Meta
              </p>
            </Reveal>

            <h1 className="mt-4 font-cabinet text-[13vw] leading-[0.96] tracking-[-0.03em] text-white sm:text-[68px] md:text-[92px] lg:text-[108px]">
              <div className="overflow-hidden">
                <motion.span
                  className="block"
                  initial={{ y: "100%", opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                  Descubra se o seu
                </motion.span>
              </div>
              <div className="overflow-hidden">
                <motion.span
                  className="block"
                  initial={{ y: "100%", opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.09, ease: [0.16, 1, 0.3, 1] }}
                >
                  negócio dá <HighlightWord delay={0.55}>lucro.</HighlightWord>
                </motion.span>
              </div>
            </h1>

            <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
              <Reveal delay={0.45}>
                <p className="max-w-[60ch] text-[19px] leading-[1.55] text-[var(--bg)]/80 md:text-[21px]">
                  Veja quanto sobra em cada venda,{" "}
                  <span className="font-fraunces italic text-white">sem planilha e sem achismo</span>. Isso começa
                  no Planejamento, quando você decide quem sua marca atende, o que entrega e
                  quanto vale, e vira preço, caixa e meta, tudo ligado.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="inline-block">
                    <Link
                      to="/"
                      hash="planos"
                      data-track="cadastro_cta_clicado"
                      data-track-props='{"contexto":"hero"}'
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      Quero ver se dá lucro
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                  </motion.div>
                  <a
                    href="#como-funciona"
                    className="group inline-flex items-center gap-2 text-[16px] text-white underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    ver como funciona
                    <ArrowDown size={15} className="transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
                  </a>
                </div>
                <p className="mt-3 text-[13px] text-[var(--bg)]/60">
                  Ver planos e assinar · começa grátis
                </p>
              </Reveal>

              <Reveal delay={0.6} y={32}>
                <div className="overflow-hidden rounded-xl border border-white/15 bg-white/5">
                  <img
                    src="/marketing/hero.png"
                    alt="Tela da Pólia mostrando o Planejamento da marca conectado ao preço e ao caixa"
                    className="h-full w-full object-cover"
                    width={1344}
                    height={752}
                  />
                </div>
              </Reveal>
            </div>
          </div>

          <motion.div
            aria-hidden="true"
            className="mx-auto mt-14 hidden md:block"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown size={20} className="text-[var(--bg)]/60" />
          </motion.div>
        </section>

        {/* 2. FAIXA DE MECANISMO — bloco de tinta cheia, teste de mais preto na home */}
        <section id="como-funciona" className="bg-[var(--ink)] py-16 md:py-24">
          <div className="mx-auto max-w-[1120px] px-6">
            <RevealGroup className="rounded-xl border border-white/15 p-8 md:p-12">
              <div className="grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-8">
                {mecanismo.map((passo) => (
                  <RevealItem key={passo.n}>
                    <span className="font-cabinet text-[56px] leading-none text-[var(--secondary)] md:text-[64px]">
                      {passo.n}
                    </span>
                    <h3 className="mt-3 text-[18px] text-white">{passo.titulo}</h3>
                    <p className="mt-2 text-[14px] leading-[1.6] text-[var(--bg)]/75">
                      {passo.desc}
                    </p>
                  </RevealItem>
                ))}
              </div>
              <p className="mt-10 max-w-[60ch] border-t border-white/15 pt-6 text-[15px] leading-[1.6] text-[var(--bg)]/75">
                Um passo puxa o outro. A clareza que você tem no começo é o que vira dinheiro no
                fim.
              </p>
            </RevealGroup>
          </div>
        </section>

        {/* 3. PROBLEMA/VILÃO — bloco de citação em tinta cheia, efeito editorial */}
        <section className="bg-[var(--ink)] py-20 text-[var(--bg)] md:py-28">
          <div className="mx-auto max-w-[860px] px-6">
            <Reveal y={28}>
              <span aria-hidden="true" className="font-cabinet block text-[64px] leading-none text-[var(--secondary)] md:text-[80px]">
                “
              </span>
              <p className="mt-2 font-cabinet text-[28px] leading-[1.25] tracking-[-0.01em] md:text-[42px]">
                O problema quase nunca é falta de esforço. É tocar o negócio no escuro, uma
                decisão de cada vez, sem ninguém juntando os números pra você.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-8 max-w-[62ch] text-[16px] leading-[1.7] text-[var(--bg)]/75 md:text-[18px]">
                Preço definido olhando a concorrente. Gasto sem saber o que sobra. Cliente que
                você corre atrás sem saber se dá lucro. Cada escolha dessas parece pequena, mas
                junto elas decidem quanto entra no fim do mês. O preço é só onde a conta aparece
                mais rápido: quem cobra no chute quase sempre lucra menos do que pensa.
              </p>
              <a
                href="#tour"
                className="mt-6 inline-flex items-center gap-2 text-[16px] text-[var(--bg)] underline decoration-[var(--secondary)] decoration-2 underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bg)]"
              >
                Ver onde as decisões se juntam
                <ArrowDown size={15} aria-hidden="true" />
              </a>
            </Reveal>
          </div>
        </section>

        {/* 4. TOUR DE MÓDULOS */}
        <section id="tour" className="relative overflow-hidden pb-12 pt-16 md:pb-16 md:pt-24">
          <img
            src="/marketing/moldura-modulos.jpg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.06]"
          />
          <div className="relative mx-auto max-w-[1120px] px-6">
            <Reveal>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                Como funciona por dentro
              </p>
              <h2 className="mt-3 max-w-[28ch] font-cabinet text-[32px] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] md:text-[44px]">
                Seis telas, uma decisão que atravessa todas.
              </h2>
            </Reveal>

            <div className="mt-10 flex flex-col gap-16 md:gap-20">
              {modulos.map((m, i) => (
                <div
                  key={m.nomeModulo}
                  className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16"
                >
                  <span
                    aria-hidden="true"
                    className="font-cabinet pointer-events-none absolute -top-6 right-0 select-none text-[120px] leading-none text-[var(--ink)]/[0.04] md:-top-10 md:text-[180px]"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Reveal className={i % 2 === 1 ? "md:order-2" : "md:order-1"}>
                    <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--secondary-text)]">
                      {m.nomeModulo}
                    </p>
                    <h3 className="mt-2 max-w-[22ch] text-[22px] text-[var(--ink)] md:text-[26px]">
                      {m.titulo}
                    </h3>
                    <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                      {m.body}
                    </p>
                  </Reveal>
                  <Reveal delay={0.12} y={32} className={i % 2 === 1 ? "md:order-1" : "md:order-2"}>
                    {/* TODO: print real de {m.printLabel} aqui, ver print capturado na sessão */}
                    <motion.div
                      whileHover={{ y: -4 }}
                      transition={{ duration: 0.25 }}
                      role="img"
                      aria-label={`Espaço reservado para ${m.printLabel}`}
                      className="flex h-[240px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[13px] text-[var(--muted)] md:h-[300px]"
                    >
                      {m.printLabel}
                    </motion.div>
                  </Reveal>
                </div>
              ))}
            </div>

            <Reveal className="mt-16 flex flex-col items-center gap-3">
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/"
                  hash="planos"
                  data-track="cadastro_cta_clicado"
                  data-track-props='{"contexto":"tour_modulos"}'
                  className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                >
                  Quero ver se dá lucro
                </Link>
              </motion.div>
              <p className="text-[13px] text-[var(--muted)]">
                Ver planos e assinar · começa grátis
              </p>
            </Reveal>

            {/* 4.6 reforço menor */}
            <Reveal className="mt-16 grid grid-cols-1 gap-6 border-t border-[var(--line)] pt-10 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <ClipboardList
                  size={20}
                  className="mt-0.5 flex-none text-[var(--secondary-text)]"
                  aria-hidden="true"
                />
                <span className="text-[14px] leading-[1.5] text-[var(--ink-soft)]">
                  Calendário e Caderno
                </span>
              </div>
              <p className="text-[14px] leading-[1.6] text-[var(--ink-soft)] sm:col-span-2">
                Agenda e notas também ficam na Pólia, no mesmo lugar do preço, do caixa e do
                Planner.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 5. QUALIFICAÇÃO */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-[1120px] px-6">
            <Reveal>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                É pra você?
              </p>
            </Reveal>
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              <Reveal>
                <div className="h-full rounded-xl border-2 border-[var(--secondary)] bg-white p-8">
                  <div className="flex items-center gap-3">
                    <CircleCheck
                      size={22}
                      className="flex-none text-[var(--secondary-text)]"
                      aria-hidden="true"
                    />
                    <h3 className="text-[19px] text-[var(--ink)]">
                      Pra quem já vende e quer enxergar o negócio inteiro
                    </h3>
                  </div>
                  <ul className="mt-5 flex flex-col gap-4">
                    {qualificacaoSim.map((item) => (
                      <li
                        key={item}
                        className="border-t border-[var(--line)] pt-4 text-[15px] leading-[1.6] text-[var(--ink-soft)] first:border-t-0 first:pt-0"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <Reveal delay={0.12}>
                <div className="h-full rounded-xl border border-[var(--line)] bg-[var(--bg)] p-8">
                  <div className="flex items-center gap-3">
                    <Target
                      size={22}
                      className="flex-none text-[var(--muted)]"
                      aria-hidden="true"
                    />
                    <h3 className="text-[19px] text-[var(--ink)]">Ainda não é pra você</h3>
                  </div>
                  <ul className="mt-5 flex flex-col gap-4">
                    {qualificacaoNao.map((item) => (
                      <li
                        key={item}
                        className="border-t border-[var(--line)] pt-4 text-[15px] leading-[1.6] text-[var(--ink-soft)] first:border-t-0 first:pt-0"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 6. PLANOS */}
        <section id="planos" className="bg-[var(--bg)] py-16 md:py-20">
          <div className="mx-auto max-w-[1120px] px-6">
            <Reveal>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                Planos
              </p>
              <h2 className="mt-3 max-w-[24ch] font-cabinet text-[28px] leading-[1.1] tracking-[-0.02em] text-[var(--ink)] md:text-[38px]">
                Comece a enxergar o negócio sem pagar nada.
              </h2>
              <p className="mt-4 max-w-[60ch] text-[16px] leading-[1.6] text-[var(--ink-soft)]">
                O Planejamento é grátis pra sempre. Quando quiser o negócio inteiro num lugar só,
                você passa pro Controle. Sem fidelidade, cancela quando quiser.
              </p>
            </Reveal>

            <RevealGroup className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {planos.map((plano) => (
                <RevealItem
                  key={plano.nome}
                  className={`flex flex-col rounded-xl border p-8 transition-transform duration-300 hover:-translate-y-1 ${
                    plano.destaque
                      ? "border-2 border-[var(--secondary)] bg-[var(--surface-pink)]"
                      : "border-[var(--line)] bg-white"
                  }`}
                >
                  <div className="flex flex-1 flex-col">
                  {/* mantém a estrutura interna original */}
                  {plano.destaque && (
                    <span className="mb-3 inline-block w-fit rounded-[4px] bg-[var(--secondary-light)] px-2 py-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--secondary-ink)]">
                      Mais escolhido
                    </span>
                  )}
                  <h3 className="text-[22px] text-[var(--ink)]">{plano.nome}</h3>
                  <p className="mt-1 text-[14px] text-[var(--ink-soft)]">{plano.praQuem}</p>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="font-cabinet text-[36px] leading-none tracking-[-0.02em] text-[var(--ink)]">
                      {plano.preco}
                    </span>
                    <span className="text-[var(--ink-soft)]">{plano.ciclo}</span>
                  </div>
                  {plano.precoAnual && (
                    <p className="mt-1 text-[13px] text-[var(--muted)]">{plano.precoAnual}</p>
                  )}

                  <a
                    href={plano.href}
                    data-track="cadastro_cta_clicado"
                    data-track-props={`{"contexto":"planos_${plano.nome.toLowerCase()}"}`}
                    className={`mt-6 block rounded-lg px-6 py-3 text-center text-[16px] font-semibold no-underline transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${
                      plano.destaque
                        ? "bg-[var(--secondary)] text-[var(--secondary-ink)]"
                        : "border border-[var(--ink)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-white"
                    }`}
                  >
                    {plano.botaoLabel}
                  </a>
                  <p className="mt-2 text-center text-[13px] text-[var(--muted)]">{plano.apoio}</p>

                  <ul className="mt-6 flex flex-col gap-3 border-t border-[var(--line)] pt-6">
                    {plano.features.map((item) => (
                      <li
                        key={item}
                        className="text-[14px] leading-[1.5] text-[var(--ink-soft)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* 7. FAQ — tinta cheia */}
        <section className="bg-[var(--ink)] py-16 md:py-20">
          <div className="mx-auto max-w-[720px] px-6">
            <Reveal>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--bg)]/70">
                Antes de assinar
              </p>
              <h2 className="mt-3 mb-6 font-cabinet text-[26px] leading-[1.1] tracking-[-0.02em] text-white md:text-[34px]">
                Dúvidas sobre os planos
              </h2>
            </Reveal>
            <Reveal delay={0.1} className="rounded-xl border border-white/15 bg-white px-6 md:px-8">
              <Accordion type="single" collapsible>
                {faqs.map((f) => (
                  <AccordionItem
                    key={f.pergunta}
                    value={f.pergunta}
                    className="border-t border-b-0 border-[var(--line)] first:border-t-0"
                  >
                    <AccordionTrigger className="group py-6 text-[18px] font-normal text-[var(--ink)] no-underline hover:no-underline hover:text-[var(--secondary-text)] [&>svg]:text-[var(--muted)] [&>svg]:transition-colors [&>svg]:group-hover:text-[var(--secondary-text)]">
                      {f.pergunta}
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 pt-0 text-[16px] text-[var(--ink-soft)]">
                      {f.resposta}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>

        {/* 8. CTA FINAL — cheio, sem margem, encosta direto no FAQ acima */}
        <section className="relative overflow-hidden">
          <img
            src="/marketing/fechamento.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-[var(--ink)] opacity-[0.55]" />
          <div className="relative mx-auto max-w-[720px] px-6 py-20 md:py-28">
            <Reveal className="flex flex-col items-center gap-8 text-center">
              <PoliaWordmark className="h-8 w-auto text-white md:h-10" />
              <h2 className="mx-auto max-w-[20ch] font-cabinet text-[30px] leading-[1.15] tracking-[-0.02em] text-white md:text-[44px]">
                Tocar o negócio sozinha não precisa ser no escuro.
              </h2>
              <div className="flex flex-col items-center gap-3">
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/"
                    hash="planos"
                    data-track="cadastro_cta_clicado"
                    data-track-props='{"contexto":"cta_final"}'
                    className="rounded-lg bg-[var(--secondary)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary-ink)] no-underline transition-[filter] hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Quero ver se dá lucro
                  </Link>
                </motion.div>
                <p className="text-[13px] text-white/70">
                  Ver planos e assinar · começa grátis
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter semMargemTopo />
    </div>
  );
}
