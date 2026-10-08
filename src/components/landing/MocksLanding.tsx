import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Cartela, Janela, Label } from "@/components/site/ProdutoMock";
import { calcularQuantoSobra } from "@/lib/precificacao.functions";
import { vendasParaFaturar } from "@/lib/projecao.functions";
import { fmt } from "@/components/produtos/tipos";

/**
 * Telas da Pólia One usadas nas landings de campanha (/landing-a e /landing-b).
 *
 * Mesmo negócio fictício e mesmo mês dos mocks da home (Ateliê da Aquarela), com
 * o produto que a copy das landings cita: o caderno de aquarela A5 da Ana. Custo R$ 26,95
 * (matéria-prima R$ 17,20 + embalagem R$ 3,50 + envio R$ 6,25), maquininha 5% e quanto
 * quer que sobre 40%: a calculadora sugere R$ 49,00 e sobram R$ 19,60. Mês
 * mínimo R$ 2.500, mês bom R$ 3.000, mês de celebrar R$ 8.000, R$ 2.570 até agora.
 *
 * As frases de desconto e de meta são as mesmas da Calculadora real
 * (components/produtos/Calculadora.tsx) e as contas usam as mesmas funções
 * (calcularQuantoSobra e vendasParaFaturar). Se a tela real mudar a frase,
 * muda aqui também. Desde 07/10/2026 a meta divide pelo preço (o que precisa
 * entrar), como na Projeção e no Painel: 62 vendas de R$ 49, não 154.
 */

const PRECO = 49;
const CUSTO = 26.95;
const TAXA_PCT = 5;
const META_DO_MES = 3000;
const VENDAS_PRA_META = vendasParaFaturar(META_DO_MES, PRECO);

const round2 = (v: number) => Math.round(v * 100) / 100;

function simularDesconto(pct: number) {
  const precoComDesconto = PRECO * (1 - pct / 100);
  const lucroComDesconto = calcularQuantoSobra({
    precoVenda: precoComDesconto,
    precoCusto: CUSTO,
    taxaVendaPct: TAXA_PCT,
  });
  return { precoComDesconto, lucroComDesconto };
}

/** Frase idêntica à da Calculadora real. */
function fraseDesconto(pct: number) {
  const { precoComDesconto, lucroComDesconto } = simularDesconto(pct);
  const prejuizo = lucroComDesconto < 0;
  return {
    prejuizo,
    texto: `Com ${pct}% de desconto, o preço cai pra ${fmt(round2(precoComDesconto))} e sobram ${fmt(
      round2(lucroComDesconto),
    )}.${prejuizo ? " Esse desconto dá prejuízo." : ""}`,
  };
}

const fraseMeta = `Pra entrar a Meta do mês (${fmt(META_DO_MES)}) só com esse produto: ${VENDAS_PRA_META} vendas de ${fmt(PRECO)}.`;

function CabecalhoProduto() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-10 w-10 flex-none rounded-md bg-[var(--accent)]" />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[var(--ink)]">
          Caderno de aquarela A5
        </p>
        <p className="text-[12px] text-[var(--muted)]">produto físico · calculadora</p>
      </div>
    </div>
  );
}

function LinhaValor({ nome, valor }: { nome: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-[var(--line)] py-2 text-[12.5px] text-[var(--ink-soft)] last:border-b-0">
      <span>{nome}</span>
      <span className="font-semibold text-[var(--ink)]">{valor}</span>
    </div>
  );
}

function FaixaSobra() {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--surface-pink)] px-3.5 py-3">
      <span className="font-accent text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
        Sobra de verdade
      </span>
      <span className="text-[18px] leading-none tracking-[-0.01em] text-[var(--ink)]">
        R$ 19,60 por caderno
      </span>
    </div>
  );
}

/* ─────────────────────────────── Hero B ─────────────────────────────── */

/** Card do hero da landing B: o preço que sai da conta, ligado à meta do mês. */
export function MockCalculadoraHero({ className }: { className?: string }) {
  return (
    <Cartela
      label={`Calculadora da Pólia One: caderno de aquarela A5 a R$ 49, sobram R$ 19,60 por caderno. ${fraseMeta}`}
      className={className}
    >
      <CabecalhoProduto />
      <div className="mt-3">
        <LinhaValor nome="Preço sugerido" valor="R$ 49,00" />
      </div>
      <FaixaSobra />
      <p className="mt-3 border-t border-[var(--line)] pt-3 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">
        {fraseMeta}
      </p>
    </Cartela>
  );
}

/* ─────────────────────────────── Hero A ─────────────────────────────── */

/** Card do hero da landing A: o desconto já simulado, antes de responder. */
export function MockDescontoHero({ className }: { className?: string }) {
  const { texto } = fraseDesconto(15);
  return (
    <Cartela
      label={`Calculadora da Pólia One simulando desconto no caderno de aquarela A5: ${texto}`}
      className={className}
    >
      <CabecalhoProduto />
      <div className="mt-3">
        <LinhaValor nome="Preço sugerido" valor="R$ 49,00" />
      </div>
      <div className="mt-3 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3">
        <p className="text-[12px] text-[var(--muted)]">Simular com desconto de X% (opcional)</p>
        <p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">15</p>
      </div>
      <p className="mt-3 text-[12.5px] leading-[1.5] text-[var(--ink-soft)]">{texto}</p>
    </Cartela>
  );
}

/* ──────────────────────── Mecanismo (landing B) ──────────────────────── */

const nosFluxo = [
  { rotulo: "Planejamento", texto: "Por que a sua marca existe" },
  { rotulo: "Calculadora", texto: "R$ 49 · sobram R$ 19,60" },
  { rotulo: "Painel", texto: "Falta R$ 430 para bater a meta do mês" },
];

/** Marca → preço → mês: as três telas ligadas, com os nós entrando em sequência. */
export function MockFluxoMarcaPrecoMes({ className = "" }: { className?: string }) {
  const reduzir = useReducedMotion();
  return (
    <div
      role="img"
      aria-label="Como a Pólia One liga as partes: o Planejamento guarda por que a marca existe, a Calculadora mostra o preço de R$ 49 com R$ 19,60 de sobra, e o Painel mostra que falta R$ 430 para bater a meta do mês."
      className={className}
    >
      <motion.ol
        aria-hidden="true"
        className="flex list-none flex-col items-stretch gap-3 md:flex-row md:items-center"
        initial="oculto"
        whileInView="visivel"
        viewport={{ once: true, amount: 0.4 }}
        variants={{ oculto: {}, visivel: { transition: { staggerChildren: reduzir ? 0 : 0.12 } } }}
      >
        {nosFluxo.map((no, i) => (
          <motion.li
            key={no.rotulo}
            className="flex flex-col items-center gap-3 md:flex-1 md:flex-row"
            variants={{
              oculto: { opacity: 0, transform: reduzir ? "none" : "translateY(8px)" },
              visivel: {
                opacity: 1,
                transform: "translateY(0px)",
                transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
              },
            }}
          >
            {/* Sem faixa colorida na lateral do cartão (decisão da Sil, 07/10/2026). */}
            <div className="w-full rounded-xl border border-[var(--line)] bg-white p-4">
              <Label>{no.rotulo}</Label>
              <p className="mt-1.5 text-[15px] font-semibold leading-[1.35] text-[var(--ink)]">
                {no.texto}
              </p>
            </div>
            {i < nosFluxo.length - 1 && (
              <>
                <ArrowRight
                  className="hidden h-5 w-5 flex-none text-[var(--ink-soft)] md:block"
                  strokeWidth={1.5}
                />
                <ArrowDown
                  className="h-5 w-5 flex-none text-[var(--ink-soft)] md:hidden"
                  strokeWidth={1.5}
                />
              </>
            )}
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}

/* ───────────────────── Como funciona (landing B) ───────────────────── */

/** Passo 01 da B: uma pergunta do Módulo 1, a marca antes do dinheiro. */
export function MockPerguntaMarca({ className }: { className?: string }) {
  return (
    <Cartela
      label="Uma pergunta do módulo Razão de existir, do Planejamento da Pólia One, com a resposta da dona do negócio escrita abaixo."
      className={className}
    >
      <p className="font-accent text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
        <span className="mr-2 inline-block h-[3px] w-5 translate-y-[-3px] rounded-sm bg-[var(--secondary)]" />
        Módulo 1 · Razão de existir
      </p>
      <p className="mt-3 text-[16px] leading-[1.4] tracking-[-0.01em] text-[var(--ink)]">
        Por que o Ateliê existe, além de vender?
      </p>
      <p className="mt-3 rounded-md border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3 text-[12.5px] leading-[1.6] text-[var(--ink-soft)]">
        Porque papelaria virou coisa descartável. Aqui cada aquarela é pintada à mão, pra durar e
        ser guardada.
      </p>
      <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)]" />
        salvo agora
      </p>
    </Cartela>
  );
}

/** Passo 03 da B: a manchete do Painel (sem a presença, que saiu da tela em 05/10). */
export function MockFraseMes({ className }: { className?: string }) {
  return (
    <Cartela
      label="Painel da Pólia One mostrando a frase falta R$ 430 para bater a meta do mês, com R$ 2.570 registrados até agora."
      className={className}
    >
      <Label>Painel · outubro</Label>
      <p className="mt-2 text-[19px] leading-[1.2] tracking-[-0.01em] text-[var(--ink)]">
        Falta R$ 430 para bater a meta do mês.
      </p>
      <p className="mt-1 text-[12px] text-[var(--muted)]">R$ 2.570 registrados até agora.</p>
      <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-[var(--line)]">
        <div className="h-full w-[86%] rounded-full bg-[var(--secondary)]" />
      </div>
    </Cartela>
  );
}

/* ───────────────────── Como funciona (landing A) ───────────────────── */

const custosProduto = [
  ["Matéria-prima / insumos (R$)", "17,20"],
  ["Embalagem (R$)", "3,50"],
  ["Outros custos diretos (R$)", "6,25"],
  ["Taxa de maquininha / marketplace (%)", "5"],
  ["Impostos sobre a venda (%)", "0"],
  ["Quanto quer que sobre (%)", "40"],
];

/** Passo 01 da A: os custos que entram uma vez, com os rótulos reais da tela. */
export function MockCustosProduto({ className }: { className?: string }) {
  return (
    <Janela
      url="one.usepolia.com.br/calculadora"
      label="Calculadora da Pólia One com os custos do caderno de aquarela A5 preenchidos: matéria-prima, embalagem, envio, taxa da maquininha, imposto e quanto quer que sobre."
      className={className}
    >
      <CabecalhoProduto />
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {custosProduto.map(([nome, valor]) => (
          <div
            key={nome}
            className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5"
          >
            <p className="text-[12px] leading-[1.35] text-[var(--muted)]">{nome}</p>
            <p className="mt-0.5 text-[14px] font-semibold text-[var(--ink)]">{valor}</p>
          </div>
        ))}
      </div>
    </Janela>
  );
}

/** Passo 03 da A: quantas vendas fecham o mês, só com a meta preenchida. */
export function MockVendasMeta({ className }: { className?: string }) {
  return (
    <Cartela
      label={`Calculadora da Pólia One com a meta do mês preenchida: ${fraseMeta}`}
      className={className}
    >
      <Label>Com a meta do mês preenchida</Label>
      <div className="mt-3">
        <CabecalhoProduto />
      </div>
      <FaixaSobra />
      <p className="mt-3 border-t border-[var(--line)] pt-3 text-[13px] leading-[1.5] text-[var(--ink)]">
        {fraseMeta}
      </p>
    </Cartela>
  );
}

/* ───────────────────────── Desconto animado ───────────────────────── */

const PASSOS_DESCONTO = [0, 15, 45] as const;
/** Duas voltas completas e para: movimento automático com fim (WCAG 2.2.2). */
const MAX_TROCAS = PASSOS_DESCONTO.length * 2;

/**
 * O desconto acontecendo: sem desconto → 15% → 45% ("Esse desconto dá
 * prejuízo."). Gira só enquanto está na tela, para sozinho depois de duas
 * voltas e tem botão de pausar/continuar (o hover não existe no celular).
 * Com prefers-reduced-motion fica parado em 15%, sem botão.
 */
export function MockDescontoSimulado({ className }: { className?: string }) {
  // 15% e 45% de propósito: dão preço e sobra com centavos fechados no fmt real
  // (10% daria "R$ 44,1"), e o 45% já cai no prejuízo.
  const reduzir = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const naTela = useInView(ref, { amount: 0.5 });
  const [passo, setPasso] = useState(1);
  const [trocas, setTrocas] = useState(0);
  const [pausado, setPausado] = useState(false);
  const terminou = trocas >= MAX_TROCAS;
  const rodando = !reduzir && naTela && !pausado && !terminou;

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      setPasso((p) => (p + 1) % PASSOS_DESCONTO.length);
      setTrocas((n) => n + 1);
    }, 2600);
    return () => window.clearInterval(id);
  }, [rodando]);

  function alternar() {
    if (terminou) {
      setTrocas(0);
      setPasso(0);
      setPausado(false);
      return;
    }
    setPausado((p) => !p);
  }

  const pct = reduzir ? 15 : PASSOS_DESCONTO[passo];
  const frase = pct > 0 ? fraseDesconto(pct) : null;

  return (
    <div ref={ref}>
      <Janela
        url="one.usepolia.com.br/calculadora"
        label={`Calculadora da Pólia One simulando desconto no caderno de aquarela A5 a R$ 49, que deixa R$ 19,60 de sobra. ${fraseDesconto(15).texto} ${fraseDesconto(45).texto}`}
        className={className}
      >
        <CabecalhoProduto />
        <div className="mt-3">
          <LinhaValor nome="Preço sugerido" valor="R$ 49,00" />
          <LinhaValor nome="Custo por unidade" valor="R$ 26,95" />
        </div>
        <FaixaSobra />

        <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
          <p className="text-[12px] text-[var(--muted)]">Simular com desconto de X% (opcional)</p>
          <div className="mt-1.5 flex h-10 items-center rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 text-[15px] font-semibold text-[var(--ink)]">
            {pct > 0 ? pct : ""}
            <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-[var(--ink-soft)] motion-reduce:animate-none" />
          </div>
          <div className="mt-3 min-h-[44px]">
            <AnimatePresence mode="wait" initial={false}>
              {frase && (
                <motion.p
                  key={pct}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.2 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className={`rounded-sm px-2.5 py-2 text-[13px] leading-[1.5] ${
                    frase.prejuizo
                      ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                      : "text-[var(--ink-soft)]"
                  }`}
                >
                  {frase.texto}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Janela>
      {!reduzir && (
        <button
          type="button"
          onClick={alternar}
          aria-pressed={!terminou ? pausado : undefined}
          className="mt-3 inline-flex min-h-[44px] items-center rounded-md px-2 text-[14px] font-semibold text-[var(--ink-soft)] underline decoration-1 underline-offset-4 hover:text-[var(--ink)]"
        >
          {terminou ? "Ver de novo" : pausado ? "Continuar a simulação" : "Pausar a simulação"}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────── Os três números do mês ─────────────────────── */

const tresNumeros = [
  { nome: "Mínimo pra fechar as contas", valor: "R$ 2.500", pct: 31.25 },
  { nome: "Mês bom", valor: "R$ 3.000", pct: 37.5 },
  { nome: "Mês de celebrar", valor: "R$ 8.000", pct: 100 },
];

/** Financeiro: os três números e onde o mês está entre eles. */
export function MockTresNumeros({ className }: { className?: string }) {
  const reduzir = useReducedMotion();
  return (
    <Cartela
      label="Financeiro da Pólia One com os três números do mês: mínimo pra fechar as contas R$ 2.500, mês bom R$ 3.000 e mês de celebrar R$ 8.000. Até agora entraram R$ 2.570, acima do mínimo."
      className={className}
    >
      <Label>Financeiro · os três números do mês</Label>
      <div className="mt-3">
        {tresNumeros.map((n) => (
          <LinhaValor key={n.nome} nome={n.nome} valor={n.valor} />
        ))}
      </div>
      <div className="relative mt-5 h-2 rounded-full bg-[var(--line)]">
        <motion.div
          className="h-full origin-left rounded-full bg-[var(--secondary)]"
          style={{ width: "32.1%" }}
          initial={{ transform: reduzir ? "scaleX(1)" : "scaleX(0)" }}
          whileInView={{ transform: "scaleX(1)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        />
        {tresNumeros.slice(0, 2).map((n) => (
          <span
            key={n.nome}
            className="absolute top-[-3px] h-[14px] w-px bg-[var(--ink-soft)]"
            style={{ left: `${n.pct}%` }}
          />
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-[var(--ink-soft)]">
        Até agora: <span className="font-semibold text-[var(--ink)]">R$ 2.570</span>, acima do
        mínimo.
      </p>
    </Cartela>
  );
}
