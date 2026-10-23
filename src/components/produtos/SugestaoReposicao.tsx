// "O que repor" / "O que comprar" (ONE-134): o mesmo bloco no topo da aba
// Estoque (produto) e da aba Insumos (material). A regra mora em
// lib/reposicao.ts; aqui só a tela. Abre recolhido, com um resumo: aberto de
// cara, no celular ele empurrava a tabela de estoque pra baixo da dobra.

import { useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { BlockError } from "@/components/ui/BlockError";
import { BTN_MIUDO_ACAO } from "@/lib/botoes";
import { fmtQtd } from "@/lib/producao";
import {
  COBERTURAS,
  DIAS_URGENTE,
  JANELA_DIAS,
  sugerirReposicao,
  type Cobertura,
  type ItemParaRepor,
  type Sugestao,
} from "@/lib/reposicao";

/** Quantos aparecem antes do "Ver todos". */
const VISIVEIS = 5;

const SUBTITULO =
  "font-accent mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-soft)]";

export function SugestaoReposicao({
  id,
  titulo,
  acao,
  origem,
  itens,
  unidadeDe,
  inteiroDe,
  carregando,
  erro,
  onTentarDeNovo,
}: {
  /** Prefixo dos ids da seção. */
  id: string;
  titulo: string;
  /** "repor" ou "comprar", nos textos. */
  acao: string;
  /** De onde sai o giro: venda (produto) ou produção (insumo). */
  origem: "venda" | "producao";
  itens: readonly ItemParaRepor[];
  /** Unidade de cada item (" g"); produto conta em peça e fica vazio. */
  unidadeDe?: (chave: string) => string;
  /** Peça inteira? Produto sempre; insumo em "un", folhas, pacotes. */
  inteiroDe: (chave: string) => boolean;
  carregando: boolean;
  erro: boolean;
  onTentarDeNovo: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [cobertura, setCobertura] = useState<Cobertura>(30);
  const [todos, setTodos] = useState(false);
  const lista = sugerirReposicao(itens, cobertura, { inteiro: inteiroDe });
  const visiveis = todos ? lista : lista.slice(0, VISIVEIS);
  const urgentes = lista.filter((s) => s.urgente).length;
  const temHistorico = itens.some((i) => i.saiu > 0);
  const u = (chave: string) => unidadeDe?.(chave) ?? "";

  const resumo = carregando
    ? "fazendo a conta"
    : erro
      ? "a conta não carregou"
      : lista.length === 0
        ? "nada por agora"
        : `${lista.length} ${lista.length === 1 ? "item" : "itens"}${
            urgentes
              ? `, ${urgentes} ${urgentes === 1 ? "acaba" : "acabam"} em até ${DIAS_URGENTE} dias`
              : ""
          }`;
  const anuncio =
    aberto && !carregando && !erro
      ? lista.length
        ? `${lista.length} ${lista.length === 1 ? "item" : "itens"} pra ${acao} em ${cobertura} dias.`
        : `Nada pra ${acao} em ${cobertura} dias.`
      : "";

  const linha = (s: Sugestao) => {
    const un = u(s.chave);
    const detalhes = [
      s.saldo < 0
        ? `acabou, faltaram ${fmtQtd(-s.saldo)}${un} ${origem === "venda" ? "nas vendas" : "na produção"}`
        : s.saldo === 0
          ? "acabou"
          : `tem ${fmtQtd(s.saldo)}${un}`,
      s.saiu > 0
        ? `${origem === "venda" ? "saíram" : "foram pra produção"} ${fmtQtd(s.saiu)}${un} em ${s.dias} dias`
        : null,
      s.saldo > 0 && s.acabaEm != null
        ? Math.floor(s.acabaEm) < 1
          ? "acaba hoje"
          : `acaba em uns ${Math.floor(s.acabaEm)} ${Math.floor(s.acabaEm) === 1 ? "dia" : "dias"}`
        : null,
      `pra ${cobertura} dias precisa de ${fmtQtd(s.precisa)}${un}${
        s.minimo > 0 ? ` (já com o mínimo de ${fmtQtd(s.minimo)}${un})` : ""
      }`,
    ].filter(Boolean);
    return (
      <li
        key={s.chave}
        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-[var(--line)] py-3 first:border-t-0"
      >
        <div className="min-w-0">
          <p className="text-[14px] text-[var(--ink)]">{s.nome}</p>
          <p
            className={`text-[13px] ${s.saldo <= 0 ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}
          >
            {detalhes.join(" · ")}
          </p>
        </div>
        <p className="text-[14px] font-semibold tabular-nums text-[var(--ink)]">
          faltam {fmtQtd(s.repor)}
          {un}
        </p>
      </li>
    );
  };

  const urgentesVisiveis = visiveis.filter((s) => s.urgente);
  const restoVisivel = visiveis.filter((s) => !s.urgente);

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="mb-6 rounded-xl border border-[var(--line)] bg-white p-4"
    >
      <h2 id={`${id}-titulo`} className="font-cabinet text-[18px] font-semibold text-[var(--ink)]">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          aria-controls={`${id}-corpo`}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span>
            {titulo}
            <span className="ml-2 font-sans text-[14px] font-normal text-[var(--ink-soft)]">
              {resumo}
            </span>
          </span>
          {aberto ? (
            <ChevronUp size={18} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
          ) : (
            <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
          )}
        </button>
      </h2>
      {/* Sempre montado: o leitor de tela só anuncia região viva que já existia. */}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>

      {aberto && (
        <div id={`${id}-corpo`}>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span id={`${id}-prazo`} className="text-[13px] text-[var(--ink-soft)]">
              Pra quantos dias:
            </span>
            <div role="group" aria-labelledby={`${id}-prazo`} className="flex flex-wrap gap-2">
              {COBERTURAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cobertura === c}
                  onClick={() => setCobertura(c)}
                  className={`${BTN_MIUDO_ACAO} ${
                    cobertura === c ? "!bg-[var(--secondary)] font-bold" : "bg-white"
                  }`}
                >
                  {cobertura === c && <Check size={14} aria-hidden="true" className="mr-1" />}
                  {c} dias
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[13px] text-[var(--muted)]">
            A conta: quanto saiu por dia nos últimos {JANELA_DIAS} dias (ou desde o cadastro, se o
            item é mais novo), vezes os dias escolhidos, mais o mínimo, menos o que tem hoje.
            Confira antes de comprar ou produzir.
          </p>

          {erro ? (
            <div className="mt-3">
              <BlockError
                message={`A Pólia One não conseguiu ler o que saiu nos últimos ${JANELA_DIAS} dias. O estoque está certo, só a sugestão ficou de fora.`}
                onRetry={onTentarDeNovo}
              />
            </div>
          ) : carregando ? (
            <p className="mt-3 text-[14px] text-[var(--muted)]">Fazendo a conta…</p>
          ) : lista.length === 0 ? (
            <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
              {temHistorico
                ? `Nada pra ${acao} nos próximos ${cobertura} dias, pelo ritmo de saída de agora.`
                : origem === "venda"
                  ? `A conta usa as vendas registradas, e ainda não tem nenhuma nos últimos ${JANELA_DIAS} dias. Por enquanto, só entra aqui o que já está abaixo do mínimo.`
                  : `A conta usa as produções feitas em Registrar produção, e ainda não tem nenhuma nos últimos ${JANELA_DIAS} dias. Por enquanto, só entra aqui o que já está abaixo do mínimo.`}
            </p>
          ) : (
            <>
              {urgentesVisiveis.length > 0 && (
                <>
                  <p className={SUBTITULO}>Acaba em até {DIAS_URGENTE} dias</p>
                  <ul>{urgentesVisiveis.map(linha)}</ul>
                </>
              )}
              {restoVisivel.length > 0 && (
                <>
                  <p className={SUBTITULO}>Pros próximos {cobertura} dias</p>
                  <ul>{restoVisivel.map(linha)}</ul>
                </>
              )}
              {lista.length > VISIVEIS && (
                <button
                  type="button"
                  onClick={() => setTodos((t) => !t)}
                  aria-expanded={todos}
                  className="inline-flex min-h-11 items-center text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
                >
                  {todos ? "Ver menos" : `Ver todos (${lista.length})`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
